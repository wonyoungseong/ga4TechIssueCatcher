import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Activity, FileText, Archive, Settings, Sliders } from 'lucide-react';
import './Sidebar.css';

const Sidebar = () => {
  const location = useLocation();

  const menuItems = [
    { path: '/', icon: Home, label: '대시보드' },
    { path: '/processing', icon: Activity, label: '프로세싱' },
    { path: '/reports', icon: FileText, label: '리포트' },
    { path: '/saved-results', icon: Archive, label: '저장된 결과' },
    { path: '/status-management', icon: Sliders, label: '상태 관리' },
    { path: '/settings', icon: Settings, label: '설정' },
  ];

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h2>Crawler Monitor</h2>
        <p className="sidebar-subtitle">Analytics Tracking System</p>
      </div>
      
      <nav className="sidebar-nav">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-item ${isActive ? 'active' : ''}`}
            >
              <Icon size={20} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
      
      <div className="sidebar-footer">
        <p>version 1.0.0</p>
        <p>© 2025 Crawler Monitor</p>
      </div>
    </div>
  );
};

export default Sidebar;
