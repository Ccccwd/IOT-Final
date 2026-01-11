import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Modal,
  Descriptions,
  DatePicker,
  Select,
  message,
  Statistic,
  Row,
  Col,
} from 'antd';
import {
  ReloadOutlined,
  EyeOutlined,
  SearchOutlined,
  DollarOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { orderAPI } from '../services/api';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;
const { Option } = Select;

function OrderManagement() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [filters, setFilters] = useState({
    status: '',
    userId: '',
    dateRange: null,
  });

  // 获取订单列表
  const fetchOrders = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filters.userId) params.user_id = filters.userId;
      const response = await orderAPI.getOrders(params);
      setOrders(response);
    } catch (error) {
      message.error('获取订单列表失败: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [filters]);

  // 查看订单详情
  const viewDetail = (order) => {
    setSelectedOrder(order);
    setDetailModalVisible(true);
  };

  // 筛选后的订单
  const filteredOrders = orders.filter((order) => {
    let match = true;
    if (filters.status && order.status !== filters.status) {
      match = false;
    }
    if (filters.dateRange) {
      const [start, end] = filters.dateRange;
      const orderDate = dayjs(order.created_at);
      if (orderDate.isBefore(start) || orderDate.isAfter(end)) {
        match = false;
      }
    }
    return match;
  });

  // 订单统计
  const stats = {
    total: orders.length,
    active: orders.filter((o) => o.status === 'active').length,
    completed: orders.filter((o) => o.status === 'completed').length,
    cancelled: orders.filter((o) => o.status === 'cancelled').length,
    totalRevenue: orders
      .filter((o) => o.status === 'completed' && o.cost)
      .reduce((sum, o) => sum + parseFloat(o.cost), 0),
  };

  // 表格列定义
  const columns = [
    {
      title: '订单 ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
      sorter: (a, b) => a.id - b.id,
    },
    {
      title: '用户 ID',
      dataIndex: 'user_id',
      key: 'user_id',
      width: 80,
    },
    {
      title: '车辆 ID',
      dataIndex: 'bike_id',
      key: 'bike_id',
      width: 80,
    },
    {
      title: '开始时间',
      dataIndex: 'start_time',
      key: 'start_time',
      render: (text) => (text ? dayjs(text).format('YYYY-MM-DD HH:mm') : '-'),
      sorter: (a, b) => new Date(a.start_time || 0) - new Date(b.start_time || 0),
    },
    {
      title: '结束时间',
      dataIndex: 'end_time',
      key: 'end_time',
      render: (text) => (text ? dayjs(text).format('YYYY-MM-DD HH:mm') : '-'),
    },
    {
      title: '时长',
      dataIndex: 'duration_minutes',
      key: 'duration_minutes',
      render: (value) => (value ? `${value} 分钟` : '-'),
      sorter: (a, b) => (a.duration_minutes || 0) - (b.duration_minutes || 0),
    },
    {
      title: '费用',
      dataIndex: 'cost',
      key: 'cost',
      render: (value) => (value ? `¥${parseFloat(value).toFixed(2)}` : '-'),
      sorter: (a, b) => (a.cost || 0) - (b.cost || 0),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        const colors = {
          active: 'processing',
          completed: 'success',
          cancelled: 'default',
        };
        const texts = {
          active: '进行中',
          completed: '已完成',
          cancelled: '已取消',
        };
        return <Tag color={colors[status]}>{texts[status]}</Tag>;
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_, record) => (
        <Button
          type="link"
          icon={<EyeOutlined />}
          onClick={() => viewDetail(record)}
        >
          详情
        </Button>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="总订单数"
              value={stats.total}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="进行中"
              value={stats.active}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已完成"
              value={stats.completed}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="总收入"
              value={stats.totalRevenue}
              precision={2}
              prefix={<DollarOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 订单列表 */}
      <Card
        title="订单管理"
        extra={
          <Space>
            <Select
              placeholder="筛选状态"
              style={{ width: 120 }}
              allowClear
              onChange={(value) => setFilters({ ...filters, status: value || '' })}
            >
              <Option value="active">进行中</Option>
              <Option value="completed">已完成</Option>
              <Option value="cancelled">已取消</Option>
            </Select>
            <RangePicker
              placeholder={['开始日期', '结束日期']}
              onChange={(dates) =>
                setFilters({ ...filters, dateRange: dates })
              }
            />
            <Button
              icon={<ReloadOutlined />}
              onClick={fetchOrders}
              loading={loading}
            >
              刷新
            </Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={filteredOrders}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条订单`,
          }}
          scroll={{ x: 1200 }}
        />
      </Card>

      {/* 订单详情模态框 */}
      <Modal
        title="订单详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={null}
        width={800}
      >
        {selectedOrder && (
          <Descriptions column={2} bordered size="small">
            <Descriptions.Item label="订单 ID" span={2}>
              {selectedOrder.id}
            </Descriptions.Item>
            <Descriptions.Item label="用户 ID" span={1}>
              {selectedOrder.user_id}
            </Descriptions.Item>
            <Descriptions.Item label="车辆 ID" span={1}>
              {selectedOrder.bike_id}
            </Descriptions.Item>
            <Descriptions.Item label="开始时间" span={1}>
              {selectedOrder.start_time
                ? dayjs(selectedOrder.start_time).format(
                    'YYYY-MM-DD HH:mm:ss'
                  )
                : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="结束时间" span={1}>
              {selectedOrder.end_time
                ? dayjs(selectedOrder.end_time).format('YYYY-MM-DD HH:mm:ss')
                : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="骑行时长" span={1}>
              {selectedOrder.duration_minutes
                ? `${selectedOrder.duration_minutes} 分钟`
                : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="费用" span={1}>
              {selectedOrder.cost
                ? `¥${parseFloat(selectedOrder.cost).toFixed(2)}`
                : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="距离" span={1}>
              {selectedOrder.distance_km
                ? `${selectedOrder.distance_km} km`
                : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="状态" span={1}>
              <Tag
                color={
                  selectedOrder.status === 'active'
                    ? 'processing'
                    : selectedOrder.status === 'completed'
                    ? 'success'
                    : 'default'
                }
              >
                {
                  {
                    active: '进行中',
                    completed: '已完成',
                    cancelled: '已取消',
                  }[selectedOrder.status]
                }
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="开始位置" span={2}>
              {selectedOrder.start_lat && selectedOrder.start_lng
                ? `${parseFloat(selectedOrder.start_lat).toFixed(6)}, ${parseFloat(
                    selectedOrder.start_lng
                  ).toFixed(6)}`
                : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="结束位置" span={2}>
              {selectedOrder.end_lat && selectedOrder.end_lng
                ? `${parseFloat(selectedOrder.end_lat).toFixed(6)}, ${parseFloat(
                    selectedOrder.end_lng
                  ).toFixed(6)}`
                : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="创建时间" span={2}>
              {dayjs(selectedOrder.created_at).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
}

export default OrderManagement;
