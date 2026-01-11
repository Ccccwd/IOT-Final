import React from 'react';
import { ConfigProvider, Layout, theme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import Dashboard from './components/Dashboard';
import './App.css';

const { Header, Content } = Layout;

function App() {
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: '#1890ff',
          borderRadius: 8,
        },
      }}
    >
      <Layout className="app-layout">
        <Header className="app-header">
          <div className="header-content">
            <div className="logo">
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="white"
                xmlns="http://www.w3.org/2000/svg"
                style={{ marginRight: 12 }}
              >
                <path d="M15.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM5 12c-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5-2.2-5-5-5zm0 8.5c-1.9 0-3.5-1.6-3.5-3.5s1.6-3.5 3.5-3.5 3.5 1.6 3.5 3.5-1.6 3.5-3.5 3.5zm5.8-10l2.4-2.4.8.8c1.3 1.3 3 2.1 5.1 2.1V9c-1.5 0-2.7-.6-3.6-1.5l-1.9-1.9c-.5-.4-1.2-.4-1.6 0l-1.6 1.6c-.6.6-.9 1.4-.9 2.2V15H9v-4.2c0-.4.2-.8.4-1.1l1.4-1.4zM19 12c-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5-2.2-5-5-5zm0 8.5c-1.9 0-3.5-1.6-3.5-3.5s1.6-3.5 3.5-3.5 3.5 1.6 3.5 3.5-1.6 3.5-3.5 3.5z" />
              </svg>
              <h1 style={{ color: 'white', margin: 0, fontSize: 20 }}>
                智能共享单车管理系统
              </h1>
            </div>
            <div className="header-info">
              <span style={{ color: 'rgba(255,255,255,0.85)' }}>
                v1.0.0
              </span>
            </div>
          </div>
        </Header>
        <Content className="app-content">
          <Dashboard />
        </Content>
      </Layout>
    </ConfigProvider>
  );
}

export default App;
