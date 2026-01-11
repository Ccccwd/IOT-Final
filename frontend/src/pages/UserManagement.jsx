import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Modal,
  Form,
  Input,
  InputNumber,
  message,
  Popconfirm,
  Tooltip,
  Select,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  CreditCardOutlined,
  DeleteOutlined,
  ReloadOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { userAPI } from '../services/api';

const { Option } = Select;

function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [bindCardModalVisible, setBindCardModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [modalType, setModalType] = useState('register'); // register, registerWithCard
  const [form] = Form.useForm();
  const [bindCardForm] = Form.useForm();

  // 获取用户列表
  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await userAPI.getUsers();
      setUsers(response);
    } catch (error) {
      message.error('获取用户列表失败: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // 打开注册模态框
  const openRegisterModal = () => {
    setModalType('register');
    form.resetFields();
    setModalVisible(true);
  };

  // 打开注册并绑定卡模态框
  const openRegisterWithCardModal = () => {
    setModalType('registerWithCard');
    form.resetFields();
    setModalVisible(true);
  };

  // 打开绑定卡模态框
  const openBindCardModal = (user) => {
    setSelectedUser(user);
    bindCardForm.resetFields();
    setBindCardModalVisible(true);
  };

  // 提交注册
  const handleRegister = async (values) => {
    try {
      if (modalType === 'register') {
        await userAPI.register(values);
        message.success('用户注册成功');
      } else {
        await userAPI.registerWithCard(values);
        message.success('用户注册并绑定卡成功');
      }
      setModalVisible(false);
      form.resetFields();
      fetchUsers();
    } catch (error) {
      message.error('注册失败: ' + (error.response?.data?.detail || error.message));
    }
  };

  // 提交绑定卡
  const handleBindCard = async (values) => {
    try {
      await userAPI.bindCard(selectedUser.id, values.rfid_card);
      message.success('卡号绑定成功');
      setBindCardModalVisible(false);
      bindCardForm.resetFields();
      fetchUsers();
    } catch (error) {
      message.error('绑定失败: ' + (error.response?.data?.detail || error.message));
    }
  };

  // 表格列定义
  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 60,
    },
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
      render: (text) => (
        <Space>
          <UserOutlined />
          {text || '未设置'}
        </Space>
      ),
    },
    {
      title: '手机号',
      dataIndex: 'phone',
      key: 'phone',
      render: (text) => text || '-',
    },
    {
      title: 'RFID 卡号',
      dataIndex: 'rfid_card',
      key: 'rfid_card',
      render: (text, record) => {
        if (text) {
          return <Tag color="green">{text}</Tag>;
        }
        return (
          <Button
            type="link"
            size="small"
            icon={<CreditCardOutlined />}
            onClick={() => openBindCardModal(record)}
          >
            绑定卡号
          </Button>
        );
      },
    },
    {
      title: '余额',
      dataIndex: 'balance',
      key: 'balance',
      render: (value) => `¥${parseFloat(value).toFixed(2)}`,
      sorter: (a, b) => a.balance - b.balance,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        const colors = {
          active: 'green',
          frozen: 'red',
        };
        const texts = {
          active: '正常',
          frozen: '冻结',
        };
        return <Tag color={colors[status]}>{texts[status]}</Tag>;
      },
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (text) => new Date(text).toLocaleString('zh-CN'),
      sorter: (a, b) => new Date(a.created_at) - new Date(b.created_at),
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_, record) => (
        <Space size="small">
          {!record.rfid_card && (
            <Tooltip title="绑定 RFID 卡">
              <Button
                type="primary"
                size="small"
                icon={<CreditCardOutlined />}
                onClick={() => openBindCardModal(record)}
              >
                绑卡
              </Button>
            </Tooltip>
          )}
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => console.log('编辑用户:', record)}
          >
            编辑
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card
        title={
          <Space>
            <UserOutlined />
            用户管理
          </Space>
        }
        extra={
          <Space>
            <Button icon={<PlusOutlined />} onClick={openRegisterModal}>
              注册用户
            </Button>
            <Button
              icon={<CreditCardOutlined />}
              onClick={openRegisterWithCardModal}
            >
              注册并绑定卡
            </Button>
            <Button icon={<ReloadOutlined />} onClick={fetchUsers}>
              刷新
            </Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={users}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 个用户`,
          }}
        />
      </Card>

      {/* 注册模态框 */}
      <Modal
        title={modalType === 'register' ? '注册新用户' : '注册新用户并绑定卡号'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={() => form.submit()}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleRegister}
          initialValues={{ balance: 50.0 }}
        >
          <Form.Item
            label="用户名"
            name="username"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input placeholder="请输入用户名" />
          </Form.Item>

          <Form.Item
            label="手机号"
            name="phone"
            rules={[
              { required: false },
              { pattern: /^1[3-9]\d{9}$/, message: '请输入有效的手机号' },
            ]}
          >
            <Input placeholder="请输入手机号（可选）" />
          </Form.Item>

          {modalType === 'registerWithCard' && (
            <Form.Item
              label="RFID 卡号"
              name="rfid_card"
              rules={[{ required: true, message: '请输入 RFID 卡号' }]}
            >
              <Input placeholder="请输入 RFID 卡号" />
            </Form.Item>
          )}

          <Form.Item
            label="初始余额"
            name="balance"
            rules={[{ required: true, message: '请输入初始余额' }]}
          >
            <InputNumber
              min={0}
              precision={2}
              style={{ width: '100%' }}
              prefix="¥"
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* 绑定卡号模态框 */}
      <Modal
        title="绑定 RFID 卡"
        open={bindCardModalVisible}
        onCancel={() => setBindCardModalVisible(false)}
        onOk={() => bindCardForm.submit()}
        destroyOnClose
      >
        {selectedUser && (
          <div>
            <p>
              <strong>用户：</strong>{selectedUser.username || '未设置'}
            </p>
            <p>
              <strong>用户 ID：</strong>{selectedUser.id}
            </p>
            <Form
              form={bindCardForm}
              layout="vertical"
              onFinish={handleBindCard}
            >
              <Form.Item
                label="RFID 卡号"
                name="rfid_card"
                rules={[
                  { required: true, message: '请输入 RFID 卡号' },
                  { min: 1, max: 20, message: '卡号长度为 1-20 个字符' },
                ]}
              >
                <Input placeholder="请刷卡或输入卡号" />
              </Form.Item>
            </Form>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default UserManagement;
