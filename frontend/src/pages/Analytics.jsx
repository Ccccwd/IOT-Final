import React, { useState, useEffect } from 'react';
import { Card, Row, Col, DatePicker, Select, Space, Statistic, Table, Tag, Button } from 'antd';
import {
  ReloadOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  DollarOutlined,
  CarOutlined,
  UserOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import dayjs from 'dayjs';
import api, { adminAPI } from '../services/api';

const { RangePicker } = DatePicker;
const { Option } = Select;

function Analytics() {
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState([
    dayjs().subtract(7, 'day'),
    dayjs(),
  ]);
  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalOrders: 0,
    avgDuration: 0,
    activeUsers: 0,
  });
  const [ordersByDay, setOrdersByDay] = useState([]);
  const [revenueByDay, setRevenueByDay] = useState([]);
  const [bikeStatusData, setBikeStatusData] = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);

  // 获取统计数据
  const fetchStats = async () => {
    try {
      setLoading(true);

      // 获取仪表盘统计数据
      const dashboardData = await api.get('/admin/dashboard');
      setStats({
        totalRevenue: dashboardData.today_revenue || 0,
        totalOrders: dashboardData.today_orders || 0,
        avgDuration: 0, // 后端暂未提供
        activeUsers: dashboardData.total_users || 0,
      });

      // 获取订单列表（最近10条）
      const ordersData = await api.get('/orders', { params: { limit: 10 } });
      setRecentOrders(ordersData.map(order => ({
        id: order.id,
        user: order.user_id || '未知',
        bike_code: `BIKE_${order.bike_id}`,
        start_time: order.start_time,
        duration: order.duration_minutes || 0,
        cost: order.cost || 0,
        status: order.status,
      })));

      // 车辆状态分布
      setBikeStatusData([
        { value: dashboardData.idle_bikes || 0, name: '空闲' },
        { value: dashboardData.riding_bikes || 0, name: '骑行中' },
        { value: dashboardData.fault_bikes || 0, name: '故障' },
      ]);

      // 获取趋势数据（从后端API）
      const trendsData = await adminAPI.getStatisticsTrends(7);
      const days = trendsData.trends.map(t => t.display_date);
      const orderCounts = trendsData.trends.map(t => t.order_count);
      const revenues = trendsData.trends.map(t => t.revenue);

      setOrdersByDay({ days, counts: orderCounts });
      setRevenueByDay({ days, amounts: revenues });

    } catch (error) {
      console.error('获取统计数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [dateRange]);

  // 订单趋势图配置
  const orderTrendOption = {
    title: {
      text: '订单量趋势',
      left: 'center',
    },
    tooltip: {
      trigger: 'axis',
    },
    xAxis: {
      type: 'category',
      data: ordersByDay.days,
    },
    yAxis: {
      type: 'value',
      name: '订单数',
    },
    series: [
      {
        name: '订单量',
        type: 'line',
        data: ordersByDay.counts,
        smooth: true,
        areaStyle: {
          opacity: 0.3,
        },
        itemStyle: {
          color: '#1890ff',
        },
      },
    ],
  };

  // 收入趋势图配置
  const revenueTrendOption = {
    title: {
      text: '收入趋势',
      left: 'center',
    },
    tooltip: {
      trigger: 'axis',
      formatter: '{b}: ¥{c}',
    },
    xAxis: {
      type: 'category',
      data: revenueByDay.days,
    },
    yAxis: {
      type: 'value',
      name: '收入（元）',
    },
    series: [
      {
        name: '收入',
        type: 'bar',
        data: revenueByDay.amounts,
        itemStyle: {
          color: '#52c41a',
        },
      },
    ],
  };

  // 车辆状态饼图
  const bikeStatusOption = {
    title: {
      text: '车辆状态分布',
      left: 'center',
    },
    tooltip: {
      trigger: 'item',
      formatter: '{a} <br/>{b}: {c} ({d}%)',
    },
    legend: {
      orient: 'vertical',
      left: 'left',
    },
    series: [
      {
        name: '车辆状态',
        type: 'pie',
        radius: '50%',
        data: bikeStatusData,
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.5)',
          },
        },
      },
    ],
  };

  // 最近订单表格列
  const recentOrdersColumns = [
    {
      title: '订单ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: '用户',
      dataIndex: 'user',
      key: 'user',
    },
    {
      title: '车辆编号',
      dataIndex: 'bike_code',
      key: 'bike_code',
    },
    {
      title: '开始时间',
      dataIndex: 'start_time',
      key: 'start_time',
    },
    {
      title: '时长（分钟）',
      dataIndex: 'duration',
      key: 'duration',
    },
    {
      title: '费用（元）',
      dataIndex: 'cost',
      key: 'cost',
      render: (cost) => `¥${cost.toFixed(2)}`,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        const colors = {
          active: 'blue',
          completed: 'green',
          cancelled: 'red',
        };
        const texts = {
          active: '进行中',
          completed: '已完成',
          cancelled: '已取消',
        };
        return <Tag color={colors[status]}>{texts[status]}</Tag>;
      },
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      {/* 日期筛选器 */}
      <Card style={{ marginBottom: 16 }}>
        <Space size="large">
          <RangePicker
            value={dateRange}
            onChange={(dates) => setDateRange(dates)}
            allowClear={false}
          />
          <Button
            type="primary"
            icon={<ReloadOutlined />}
            onClick={fetchStats}
            loading={loading}
          >
            刷新数据
          </Button>
        </Space>
      </Card>

      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="总收入"
              value={stats.totalRevenue}
              precision={2}
              prefix={<DollarOutlined />}
              valueStyle={{ color: '#52c41a' }}
              suffix="元"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="总订单数"
              value={stats.totalOrders}
              prefix={<CarOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="平均时长"
              value={stats.avgDuration}
              suffix="分钟"
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="活跃用户"
              value={stats.activeUsers}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 图表行1 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={12}>
          <Card>
            <ReactECharts option={orderTrendOption} style={{ height: 350 }} />
          </Card>
        </Col>
        <Col span={12}>
          <Card>
            <ReactECharts option={revenueTrendOption} style={{ height: 350 }} />
          </Card>
        </Col>
      </Row>

      {/* 图表行2 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={12}>
          <Card>
            <ReactECharts option={bikeStatusOption} style={{ height: 350 }} />
          </Card>
        </Col>
        <Col span={12}>
          <Card title="最近订单">
            <Table
              columns={recentOrdersColumns}
              dataSource={recentOrders}
              rowKey="id"
              size="small"
              pagination={false}
              scroll={{ y: 280 }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}

export default Analytics;
