import React, { useState, useMemo } from 'react';
import {
  Card,
  Select,
  Input,
  Button,
  Table,
  Tag,
  Space,
  Badge,
  Modal,
  message,
} from 'antd';
import {
  SearchOutlined,
  ReloadOutlined,
  EnvironmentOutlined,
  LockOutlined,
  UnlockOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { adminAPI } from '../services/api';

const { Option } = Select;
const { confirm } = Modal;

function ControlPanel({ bikes, loading, onRefresh, onBikeSelect }) {
  const [filter, setFilter] = useState('all');
  const [searchText, setSearchText] = useState('');
  const [controllingBikes, setControllingBikes] = useState({});

  // 远程开锁
  const handleRemoteUnlock = (bike) => {
    confirm({
      title: '确认远程开锁',
      icon: <ExclamationCircleOutlined />,
      content: `确定要远程开锁车辆 ${bike.bike_code} 吗？`,
      okText: '确定',
      cancelText: '取消',
      onOk: async () => {
        try {
          setControllingBikes(prev => ({ ...prev, [bike.id]: true }));
          await adminAPI.command({
            bike_id: bike.id,
            command: 'force_unlock',
            reason: '管理员远程开锁',
          });
          message.success(`车辆 ${bike.bike_code} 远程开锁指令已发送`);
          setTimeout(() => onRefresh && onRefresh(), 1000);
        } catch (error) {
          message.error(`远程开锁失败: ${error.response?.data?.detail || error.message}`);
        } finally {
          setControllingBikes(prev => ({ ...prev, [bike.id]: false }));
        }
      },
    });
  };

  // 远程关锁
  const handleRemoteLock = (bike) => {
    confirm({
      title: '确认远程关锁',
      icon: <ExclamationCircleOutlined />,
      content: `确定要远程关锁车辆 ${bike.bike_code} 吗？`,
      okText: '确定',
      cancelText: '取消',
      onOk: async () => {
        try {
          setControllingBikes(prev => ({ ...prev, [bike.id]: true }));
          await adminAPI.command({
            bike_id: bike.id,
            command: 'force_lock',
            reason: '管理员远程关锁',
          });
          message.success(`车辆 ${bike.bike_code} 远程关锁指令已发送`);
          setTimeout(() => onRefresh && onRefresh(), 1000);
        } catch (error) {
          message.error(`远程关锁失败: ${error.response?.data?.detail || error.message}`);
        } finally {
          setControllingBikes(prev => ({ ...prev, [bike.id]: false }));
        }
      },
    });
  };

  // 筛选车辆
  const filteredBikes = useMemo(() => {
    return bikes.filter((bike) => {
      const matchFilter = filter === 'all' || bike.status === filter;
      const matchSearch = bike.bike_code
        .toLowerCase()
        .includes(searchText.toLowerCase());
      return matchFilter && matchSearch;
    });
  }, [bikes, filter, searchText]);

  // 车辆状态统计
  const statusStats = useMemo(() => {
    return bikes.reduce(
      (acc, bike) => {
        acc[bike.status] = (acc[bike.status] || 0) + 1;
        return acc;
      },
      { idle: 0, riding: 0, fault: 0 }
    );
  }, [bikes]);

  // 表格列定义
  const columns = [
    {
      title: '车辆编号',
      dataIndex: 'bike_code',
      key: 'bike_code',
      render: (text, record) => (
        <Space>
          <EnvironmentOutlined />
          {text}
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        const colors = {
          idle: 'green',
          riding: 'red',
          fault: 'default',
        };
        const texts = {
          idle: '空闲',
          riding: '骑行中',
          fault: '故障',
        };
        return <Tag color={colors[status]}>{texts[status]}</Tag>;
      },
    },
    {
      title: '电池',
      dataIndex: 'battery',
      key: 'battery',
      width: 80,
      render: (battery) => {
        const color = battery > 50 ? '#52c41a' : battery > 20 ? '#faad14' : '#ff4d4f';
        return (
          <span style={{ color, fontWeight: 'bold' }}>
            {battery}%
          </span>
        );
      },
    },
    {
      title: '位置',
      key: 'location',
      width: 100,
      ellipsis: true,
      render: (_, record) => {
        if (!record.current_lat || !record.current_lng) {
          return <span style={{ color: '#999' }}>无数据</span>;
        }
        const location = `${parseFloat(record.current_lat).toFixed(4)},${parseFloat(record.current_lng).toFixed(4)}`;
        return (
          <span style={{ fontSize: 11 }} title={location}>
            {location}
          </span>
        );
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_, record) => {
        const isLoading = controllingBikes[record.id];

        if (record.status === 'idle') {
          return (
            <Button
              type="primary"
              size="small"
              icon={<UnlockOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                handleRemoteUnlock(record);
              }}
              loading={isLoading}
              disabled={isLoading}
            >
              远程开锁
            </Button>
          );
        } else if (record.status === 'riding') {
          return (
            <Button
              type="default"
              size="small"
              danger
              icon={<LockOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                handleRemoteLock(record);
              }}
              loading={isLoading}
              disabled={isLoading}
            >
              远程关锁
            </Button>
          );
        } else {
          return <span style={{ color: '#999' }}>-</span>;
        }
      },
    },
  ];

  return (
    <Card title="车辆列表" bordered={false}>
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        {/* 筛选器 */}
        <Select
          defaultValue="all"
          style={{ width: '100%' }}
          onChange={setFilter}
        >
          <Option value="all">全部车辆 ({bikes.length})</Option>
          <Option value="idle">
            空闲 ({statusStats.idle})
          </Option>
          <Option value="riding">
            骑行中 ({statusStats.riding})
          </Option>
          <Option value="fault">
            故障 ({statusStats.fault})
          </Option>
        </Select>

        {/* 搜索框 */}
        <Input
          placeholder="搜索车辆编号"
          prefix={<SearchOutlined />}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          allowClear
        />

        {/* 刷新按钮 */}
        <Button
          icon={<ReloadOutlined />}
          onClick={onRefresh}
          loading={loading}
          block
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          刷新状态
        </Button>

        {/* 车辆列表 */}
        <Table
          columns={columns}
          dataSource={filteredBikes}
          size="small"
          pagination={{ pageSize: 5, size: 'small' }}
          rowKey="id"
          loading={loading}
          scroll={{ x: 'max-content', y: 300 }}
          tableLayout="fixed"
          rowClassName={(record) => {
            if (record.status === 'riding') return 'row-riding';
            if (record.status === 'fault') return 'row-fault';
            return '';
          }}
          onRow={(bike) => ({
            onClick: () => {
              console.log('[ControlPanel] 点击车辆:', bike.bike_code);
              if (onBikeSelect) {
                onBikeSelect(bike);
              }
            },
            style: { cursor: 'pointer' },
          })}
        />
      </Space>
    </Card>
  );
}

export default ControlPanel;
