import { useState, useEffect, useCallback } from 'react';
import { bikeAPI, adminAPI } from '../services/api';

export const useBikes = () => {
  const [bikes, setBikes] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 获取车辆列表
  const fetchBikes = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await bikeAPI.getBikes({});
      setBikes(response.items || []);
    } catch (err) {
      setError(err.message);
      console.error('获取车辆列表失败:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // 获取统计数据
  const fetchStats = useCallback(async () => {
    try {
      const response = await adminAPI.getDashboard();
      setStats(response);
    } catch (err) {
      console.error('获取统计数据失败:', err);
    }
  }, []);

  // 更新单个车辆
  const updateBike = useCallback((bikeId, newData) => {
    console.log('[useBikes] updateBike被调用:', { bikeId, newData });
    setBikes((prevBikes) => {
      const updated = prevBikes.map((bike) =>
        bike.id === bikeId ? { ...bike, ...newData } : bike
      );
      const updatedBike = updated.find(b => b.id === bikeId);
      console.log('[useBikes] 更新后的车辆数据:', updatedBike);
      return updated;
    });
  }, []);

  // 远程控制车辆
  const controlBike = useCallback(async (bikeId, command) => {
    try {
      await adminAPI.command({ bike_id: bikeId, command });
      return { success: true };
    } catch (err) {
      console.error('远程控制失败:', err);
      return { success: false, error: err.message };
    }
  }, []);

  // 初始化数据
  useEffect(() => {
    fetchBikes();
    fetchStats();

    // 每 10 秒刷新一次车辆数据
    const interval = setInterval(() => {
      fetchBikes();
      fetchStats();
    }, 10000);

    return () => clearInterval(interval);
  }, [fetchBikes, fetchStats]);

  return {
    bikes,
    stats,
    loading,
    error,
    updateBike,
    controlBike,
    refetch: fetchBikes,
  };
};
