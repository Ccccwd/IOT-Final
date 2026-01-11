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
import api from '../services/api';

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
      const params = {
        start_date: dateRange[0].format('YYYY-MM-DD'),
        end_date: dateRange[1].format('YYYY-MM-DD'),
      };

      // 获取统计数据
      const statsResponse = await api.get('/admin/stats', { params });
      setStats({
        totalRevenue: statsResponse.data.total_revenue || 0,
        totalOrders: statsResponse.data.total_orders || 0,
        avgDuration: statsResponse.data.avg_duration || 0,
        activeUsers: statsResponse.data.active_users || 0,
      });

      // 模拟日期数据（实际应从后端获取）
      const days = [];
      const orderCounts = [];
      const revenues = [];

      for (let i = 6; i >= 0; i--) {
        const date = dayjs().subtract(i, 'day');
        days.push(date.format('MM-DD'));
        orderCounts.push(Math.floor(Math.random() * 50) + 20);
        revenues.push(Math.floor(Math.random() * 500) + 100);
      }

      setOrdersByDay({ days, counts: orderCounts });
      setRevenueByDay({ days, amounts: revenues });

      // 模拟车辆状态数据
      setBikeStatusData([
        { value: 70, name: '空闲' },
        { value: 25, name: '骑行中' },
        { value: 5, name: '故障' },
      ]);

      // 模拟最近订单
      setRecentOrders([
        {
          id: 1,
          user: '测试用户1',
          bike_code: 'BIKE_001',
          start_time: '2025-01-11 10:30',
          duration: 30,
          cost: 3.0,
          status: 'completed',
        },
        {
          id: 2,
          user: '测试用户2',
          bike_code: 'BIKE_002',
          start_time: '2025-01-11 11:15',
          duration: 45,
          cost: 4.5,
          status: 'completed',
        },
        {
          id: 3,
          user: '测试用户1',
          bike_code: 'BIKE_003',
          start_time: '2025-01-11 14:20',
          duration: 0,
          cost: 0,
          status: 'active',
        },
      ]);
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
