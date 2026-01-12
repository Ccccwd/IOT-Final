"""
后端服务器状态检查工具
用于快速诊断ESP8266无法连接的问题
"""

import socket
import requests
import json
from datetime import datetime

def get_local_ip():
    """获取本机IP地址"""
    try:
        # 创建一个UDP连接来获取本机IP（不会实际发送数据）
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception as e:
        return "无法获取"

def check_port(host, port):
    """检查端口是否开放"""
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(2)
        result = sock.connect_ex((host, port))
        sock.close()
        return result == 0
    except:
        return False

def test_api_endpoint(host, port):
    """测试API端点"""
    try:
        url = f"http://{host}:{port}/api/orders/unlock"
        data = {
            "rfid_card": "TEST1234",
            "lat": 30.3078,
            "lng": 120.4851
        }
        
        print(f"\n📡 测试API端点: {url}")
        print(f"   请求数据: {json.dumps(data, ensure_ascii=False)}")
        
        response = requests.post(url, json=data, timeout=5)
        
        print(f"   ✓ HTTP状态码: {response.status_code}")
        print(f"   ✓ 响应内容: {response.text[:200]}")
        
        return True
    except requests.exceptions.ConnectionError:
        print(f"   ❌ 连接被拒绝")
        return False
    except requests.exceptions.Timeout:
        print(f"   ❌ 请求超时")
        return False
    except Exception as e:
        print(f"   ❌ 错误: {e}")
        return False

def main():
    print("="*70)
    print("🔍 后端服务器状态检查工具")
    print("="*70)
    
    # 1. 检查本机IP
    local_ip = get_local_ip()
    print(f"\n1️⃣  本机IP地址")
    print(f"   当前IP: {local_ip}")
    print(f"   固件配置: 26.210.196.161")
    
    if local_ip != "26.210.196.161" and local_ip != "无法获取":
        print(f"   ⚠️  IP地址不匹配！")
        print(f"   💡 建议修改固件中的API_SERVER为: {local_ip}")
    else:
        print(f"   ✓ IP地址匹配")
    
    # 2. 检查端口
    print(f"\n2️⃣  端口检查 (8000)")
    port_open = check_port(local_ip if local_ip != "无法获取" else "127.0.0.1", 8000)
    
    if port_open:
        print(f"   ✓ 端口8000已开放")
    else:
        print(f"   ❌ 端口8000未开放或服务未启动")
        print(f"   💡 请检查:")
        print(f"      1. 后端服务是否正在运行")
        print(f"      2. 是否使用8000端口启动")
        print(f"      3. 防火墙是否阻止访问")
    
    # 3. 测试API端点
    print(f"\n3️⃣  API端点测试")
    if port_open:
        test_api_endpoint(local_ip if local_ip != "无法获取" else "127.0.0.1", 8000)
    else:
        print(f"   ⏭️  跳过（端口未开放）")
    
    # 4. 给出建议
    print(f"\n" + "="*70)
    print(f"📋 诊断结果和建议")
    print(f"="*70)
    
    if not port_open:
        print(f"\n❌ 后端服务器未运行或端口未开放")
        print(f"\n💡 解决方法:")
        print(f"   1. 启动后端服务:")
        print(f"      cd backend")
        print(f"      uvicorn main:app --host 0.0.0.0 --port 8000 --reload")
        print(f"\n   2. 检查Windows防火墙:")
        print(f"      - 打开 Windows Defender 防火墙")
        print(f"      - 允许Python通过防火墙")
        print(f"\n   3. 修改固件配置:")
        print(f"      const char* API_SERVER = \"{local_ip}\";")
    else:
        print(f"\n✅ 后端服务器运行正常")
        print(f"\n🔧 如果ESP8266仍无法连接:")
        print(f"   1. 确认ESP8266和电脑在同一WiFi网络")
        print(f"   2. 检查路由器是否允许设备间通信")
        print(f"   3. 尝试ping测试: ping {local_ip}")
    
    print(f"\n" + "="*70)
    
    # 5. 生成固件配置代码
    print(f"\n📝 推荐的固件配置:")
    print(f"="*70)
    print(f'const char* API_SERVER = "{local_ip}";  // 后端服务器IP')
    print(f'const int API_PORT = 8000;                 // API端口')
    print(f"="*70)

if __name__ == "__main__":
    main()
