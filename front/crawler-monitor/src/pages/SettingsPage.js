/**
 * SettingsPage Component
 *
 * 프로퍼티 관리 및 수집 여부 일괄 설정 페이지
 */

import React, { useState, useEffect, useRef } from 'react';
import { AlertCircle, Plus, Edit2, Trash2, Save, X, Check, Download, Upload } from 'lucide-react';
import './SettingsPage.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

function SettingsPage() {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newProperty, setNewProperty] = useState({
    property_name: '',
    url: '',
    expected_ga4_id: '',
    expected_gtm_id: '',
    is_active: true,
    has_consent_mode: false
  });
  const [saveStatus, setSaveStatus] = useState(null);
  const [bulkAction, setBulkAction] = useState('none');
  const [crawlerSettings, setCrawlerSettings] = useState({
    phase1_timeout: 20,
    phase2_timeout: 60
  });
  const [isEditingSettings, setIsEditingSettings] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [focusedPropertyId, setFocusedPropertyId] = useState(null);
  const fileInputRef = useRef(null);
  const propertyRowRefs = useRef({});

  // 프로퍼티 목록 및 크롤러 설정 불러오기
  useEffect(() => {
    fetchProperties();
    fetchCrawlerSettings();
  }, []);

  // URL 쿼리 파라미터로부터 focusing할 프로퍼티 확인
  useEffect(() => {
    if (properties.length === 0 || loading) return;

    const params = new URLSearchParams(window.location.search);
    const propertyId = params.get('property_id');
    const propertyName = params.get('property_name');

    if (!propertyId && !propertyName) return;

    // property_id로 먼저 검색, 없으면 property_name으로 검색
    let targetProperty = null;

    if (propertyId) {
      targetProperty = properties.find(p => p.id === propertyId);
    }

    if (!targetProperty && propertyName) {
      targetProperty = properties.find(p => p.property_name === propertyName);
    }

    if (targetProperty) {
      setFocusedPropertyId(targetProperty.id);

      // 약간의 딜레이 후 스크롤 (DOM 렌더링 대기)
      setTimeout(() => {
        const rowElement = propertyRowRefs.current[targetProperty.id];
        if (rowElement) {
          rowElement.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
          });
        }
      }, 300);

      // 3초 후 하이라이트 제거
      setTimeout(() => {
        setFocusedPropertyId(null);
      }, 3000);
    }
  }, [properties, loading]);

  const fetchProperties = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${API_BASE_URL}/api/properties?limit=1000`);
      if (!response.ok) {
        throw new Error('프로퍼티 목록을 불러오는데 실패했습니다');
      }
      const result = await response.json();
      // API returns { success: true, data: { properties: [...] } }
      setProperties(result.data?.properties || result.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 크롤러 설정 불러오기
  const fetchCrawlerSettings = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/crawler-settings`);
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          setCrawlerSettings({
            phase1_timeout: result.data.phase1_timeout || 20,
            phase2_timeout: result.data.phase2_timeout || 60
          });
        }
      }
    } catch (err) {
      // Use default values if fetch fails
      console.error('Failed to fetch crawler settings:', err);
    }
  };

  // 크롤러 설정 저장
  const handleSaveCrawlerSettings = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/crawler-settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(crawlerSettings)
      });

      if (!response.ok) {
        throw new Error('크롤러 설정 저장에 실패했습니다');
      }

      setIsEditingSettings(false);
      setSaveStatus({ type: 'success', message: '크롤러 설정이 저장되었습니다' });
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err) {
      setSaveStatus({ type: 'error', message: err.message });
      setTimeout(() => setSaveStatus(null), 3000);
    }
  };

  // 일괄 수집 여부 변경
  const handleBulkAction = async () => {
    if (bulkAction === 'none') return;

    try {
      const isActive = bulkAction === 'enable';
      const promises = properties.map(prop =>
        fetch(`${API_BASE_URL}/api/properties/${prop.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_active: isActive })
        })
      );

      await Promise.all(promises);
      await fetchProperties();
      setSaveStatus({
        type: 'success',
        message: `모든 프로퍼티를 ${isActive ? '활성화' : '비활성화'}했습니다`
      });
      setTimeout(() => setSaveStatus(null), 3000);
      setBulkAction('none');
    } catch (err) {
      setSaveStatus({ type: 'error', message: '일괄 변경에 실패했습니다' });
      setTimeout(() => setSaveStatus(null), 3000);
    }
  };

  // CSV 다운로드
  const handleDownloadCSV = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/properties/download-csv`);

      if (!response.ok) {
        throw new Error('CSV 다운로드에 실패했습니다');
      }

      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `properties_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setSaveStatus({
        type: 'success',
        message: 'CSV 파일이 다운로드되었습니다'
      });
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err) {
      setSaveStatus({ type: 'error', message: err.message });
      setTimeout(() => setSaveStatus(null), 3000);
    }
  };

  // CSV 업로드
  const handleUploadCSV = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file type
    if (!file.name.endsWith('.csv')) {
      setSaveStatus({ type: 'error', message: 'CSV 파일만 업로드 가능합니다' });
      setTimeout(() => setSaveStatus(null), 3000);
      return;
    }

    // Confirm upload
    if (!window.confirm('⚠️ 기존 모든 프로퍼티가 삭제되고 CSV 파일의 데이터로 교체됩니다.\n\n계속하시겠습니까?')) {
      event.target.value = ''; // Reset file input
      return;
    }

    try {
      setIsUploading(true);

      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${API_BASE_URL}/api/properties/upload-csv`, {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'CSV 업로드에 실패했습니다');
      }

      setSaveStatus({
        type: 'success',
        message: `${result.data.inserted}개의 프로퍼티가 업로드되었습니다`
      });
      setTimeout(() => setSaveStatus(null), 3000);

      // Reload properties
      await fetchProperties();

    } catch (err) {
      setSaveStatus({ type: 'error', message: err.message });
      setTimeout(() => setSaveStatus(null), 3000);
    } finally {
      setIsUploading(false);
      event.target.value = ''; // Reset file input
    }
  };

  // 편집 시작
  const handleStartEdit = (property) => {
    setEditingId(property.id);
    setEditForm({
      property_name: property.property_name,
      url: property.url,
      expected_ga4_id: property.expected_ga4_id || '',
      expected_gtm_id: property.expected_gtm_id || '',
      is_active: property.is_active,
      has_consent_mode: property.has_consent_mode || false
    });
  };

  // 편집 취소
  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  // 편집 저장
  const handleSaveEdit = async (propertyId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/properties/${propertyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm)
      });

      if (!response.ok) {
        throw new Error('프로퍼티 수정에 실패했습니다');
      }

      await fetchProperties();
      setEditingId(null);
      setEditForm({});
      setSaveStatus({ type: 'success', message: '프로퍼티가 수정되었습니다' });
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err) {
      setSaveStatus({ type: 'error', message: err.message });
      setTimeout(() => setSaveStatus(null), 3000);
    }
  };

  // 프로퍼티 삭제
  const handleDelete = async (propertyId, propertyName) => {
    if (!window.confirm(`"${propertyName}" 프로퍼티를 삭제하시겠습니까?`)) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/properties/${propertyId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('프로퍼티 삭제에 실패했습니다');
      }

      await fetchProperties();
      setSaveStatus({ type: 'success', message: '프로퍼티가 삭제되었습니다' });
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err) {
      setSaveStatus({ type: 'error', message: err.message });
      setTimeout(() => setSaveStatus(null), 3000);
    }
  };

  // 새 프로퍼티 추가
  const handleAddNew = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/properties`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProperty)
      });

      if (!response.ok) {
        throw new Error('프로퍼티 추가에 실패했습니다');
      }

      await fetchProperties();
      setIsAddingNew(false);
      setNewProperty({
        property_name: '',
        url: '',
        expected_ga4_id: '',
        expected_gtm_id: '',
        is_active: true,
        has_consent_mode: false
      });
      setSaveStatus({ type: 'success', message: '프로퍼티가 추가되었습니다' });
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err) {
      setSaveStatus({ type: 'error', message: err.message });
      setTimeout(() => setSaveStatus(null), 3000);
    }
  };

  if (loading) {
    return (
      <div className="settings-page">
        <div className="loading-spinner">로딩 중...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="settings-page">
        <div className="error-message">
          <AlertCircle size={24} />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="settings-page">
      <div className="settings-header">
        <h1>프로퍼티 설정</h1>
        <p>프로퍼티 관리 및 수집 여부를 설정합니다</p>
      </div>

      {/* 저장 상태 메시지 */}
      {saveStatus && (
        <div className={`save-status ${saveStatus.type}`}>
          {saveStatus.type === 'success' ? <Check size={20} /> : <AlertCircle size={20} />}
          <span>{saveStatus.message}</span>
        </div>
      )}

      {/* 크롤러 설정 섹션 */}
      <div className="bulk-actions-section">
        <h2>크롤링 설정</h2>
        <p className="section-description">Phase별 대기 시간을 설정합니다 (초 단위)</p>

        {isEditingSettings ? (
          <div className="crawler-settings-form">
            <div className="form-grid">
              <div className="form-group">
                <label>Phase 1 타임아웃 (초)</label>
                <input
                  type="number"
                  min="10"
                  max="60"
                  value={crawlerSettings.phase1_timeout}
                  onChange={(e) => {
                    const value = e.target.value;
                    setCrawlerSettings({
                      ...crawlerSettings,
                      phase1_timeout: value === '' ? '' : parseInt(value)
                    });
                  }}
                  onBlur={(e) => {
                    const value = e.target.value;
                    if (value === '' || isNaN(parseInt(value))) {
                      setCrawlerSettings({
                        ...crawlerSettings,
                        phase1_timeout: 20
                      });
                    } else {
                      const num = parseInt(value);
                      if (num < 10) {
                        setCrawlerSettings({
                          ...crawlerSettings,
                          phase1_timeout: 10
                        });
                      } else if (num > 60) {
                        setCrawlerSettings({
                          ...crawlerSettings,
                          phase1_timeout: 60
                        });
                      }
                    }
                  }}
                  placeholder="20"
                />
                <span className="field-hint">빠른 검증 단계 (범위: 10-60초, 권장: 20초)</span>
              </div>
              <div className="form-group">
                <label>Phase 2 타임아웃 (초)</label>
                <input
                  type="number"
                  min="30"
                  max="120"
                  value={crawlerSettings.phase2_timeout}
                  onChange={(e) => {
                    const value = e.target.value;
                    setCrawlerSettings({
                      ...crawlerSettings,
                      phase2_timeout: value === '' ? '' : parseInt(value)
                    });
                  }}
                  onBlur={(e) => {
                    const value = e.target.value;
                    if (value === '' || isNaN(parseInt(value))) {
                      setCrawlerSettings({
                        ...crawlerSettings,
                        phase2_timeout: 60
                      });
                    } else {
                      const num = parseInt(value);
                      if (num < 30) {
                        setCrawlerSettings({
                          ...crawlerSettings,
                          phase2_timeout: 30
                        });
                      } else if (num > 120) {
                        setCrawlerSettings({
                          ...crawlerSettings,
                          phase2_timeout: 120
                        });
                      }
                    }
                  }}
                  placeholder="60"
                />
                <span className="field-hint">느린 프로퍼티 재검증 단계 (범위: 30-120초, 권장: 60초)</span>
              </div>
            </div>
            <div className="form-actions">
              <button onClick={handleSaveCrawlerSettings} className="btn-primary">
                <Save size={18} />
                <span>저장</span>
              </button>
              <button onClick={() => {
                setIsEditingSettings(false);
                fetchCrawlerSettings(); // Reset to saved values
              }} className="btn-secondary">
                <X size={18} />
                <span>취소</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="crawler-settings-display">
            <div className="settings-info-grid">
              <div className="info-item">
                <span className="info-label">Phase 1 타임아웃:</span>
                <span className="info-value">{crawlerSettings.phase1_timeout}초</span>
              </div>
              <div className="info-item">
                <span className="info-label">Phase 2 타임아웃:</span>
                <span className="info-value">{crawlerSettings.phase2_timeout}초</span>
              </div>
            </div>
            <button
              onClick={() => setIsEditingSettings(true)}
              className="btn-secondary"
            >
              <Edit2 size={18} />
              <span>설정 변경</span>
            </button>
          </div>
        )}
      </div>

      {/* 일괄 작업 섹션 */}
      <div className="bulk-actions-section">
        <h2>일괄 작업</h2>
        <div className="bulk-actions-controls">
          <select
            value={bulkAction}
            onChange={(e) => setBulkAction(e.target.value)}
            className="bulk-action-select"
          >
            <option value="none">작업 선택...</option>
            <option value="enable">모두 활성화</option>
            <option value="disable">모두 비활성화</option>
          </select>
          <button
            onClick={handleBulkAction}
            disabled={bulkAction === 'none'}
            className="btn-primary"
          >
            실행
          </button>
        </div>
      </div>

      {/* CSV 관리 섹션 */}
      <div className="csv-management-section">
        <h2>CSV 파일 관리</h2>
        <div className="csv-info">
          <AlertCircle size={18} />
          <p>현재 프로퍼티 목록을 CSV 파일로 다운로드하거나, CSV 파일을 업로드하여 프로퍼티를 일괄 업데이트할 수 있습니다.</p>
        </div>
        <div className="csv-actions">
          <div className="csv-action-item">
            <h3>CSV 다운로드</h3>
            <p>현재 등록된 모든 프로퍼티를 CSV 파일로 다운로드합니다.</p>
            <button
              onClick={handleDownloadCSV}
              className="btn-primary"
            >
              <Download size={18} />
              <span>CSV 다운로드</span>
            </button>
          </div>
          <div className="csv-action-item">
            <h3>CSV 업로드</h3>
            <p>CSV 파일을 업로드하여 프로퍼티를 업데이트합니다. 기존 데이터는 모두 삭제됩니다.</p>
            <div className="upload-requirements">
              <strong>필수 컬럼:</strong>
              <ul>
                <li>계정명 (brand)</li>
                <li>속성명 (property_name) *</li>
                <li>Web Stream Measurement ID (GA4 ID)</li>
                <li>대표 URLs (url) *</li>
                <li>Web GTM Pubilic ID (GTM ID)</li>
                <li>is_active (true/false, 선택사항)</li>
                <li>region (선택사항)</li>
                <li>has_consent_mode (true/false, 선택사항)</li>
              </ul>
              <p className="note">* 필수 항목</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleUploadCSV}
              style={{ display: 'none' }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="btn-secondary"
              disabled={isUploading}
            >
              <Upload size={18} />
              <span>{isUploading ? '업로드 중...' : 'CSV 업로드'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 프로퍼티 추가 버튼 */}
      <div className="add-property-section">
        {!isAddingNew && (
          <button
            onClick={() => setIsAddingNew(true)}
            className="btn-add-property"
          >
            <Plus size={20} />
            <span>새 프로퍼티 추가</span>
          </button>
        )}
      </div>

      {/* 새 프로퍼티 추가 폼 */}
      {isAddingNew && (
        <div className="property-form-card new-property">
          <h3>새 프로퍼티 추가</h3>
          <div className="form-grid">
            <div className="form-group">
              <label>프로퍼티명 *</label>
              <input
                type="text"
                value={newProperty.property_name}
                onChange={(e) => setNewProperty({ ...newProperty, property_name: e.target.value })}
                placeholder="[EC] LANEIGE - KR"
              />
            </div>
            <div className="form-group">
              <label>URL *</label>
              <input
                type="text"
                value={newProperty.url}
                onChange={(e) => setNewProperty({ ...newProperty, url: e.target.value })}
                placeholder="https://example.com"
              />
            </div>
            <div className="form-group">
              <label>GA4 Measurement ID</label>
              <input
                type="text"
                value={newProperty.expected_ga4_id}
                onChange={(e) => setNewProperty({ ...newProperty, expected_ga4_id: e.target.value })}
                placeholder="G-XXXXXXXXXX"
              />
            </div>
            <div className="form-group">
              <label>GTM Container ID</label>
              <input
                type="text"
                value={newProperty.expected_gtm_id}
                onChange={(e) => setNewProperty({ ...newProperty, expected_gtm_id: e.target.value })}
                placeholder="GTM-XXXXXXX"
              />
            </div>
            <div className="form-group checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={newProperty.is_active}
                  onChange={(e) => setNewProperty({ ...newProperty, is_active: e.target.checked })}
                />
                <span>수집 활성화</span>
              </label>
            </div>
            <div className="form-group checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={newProperty.has_consent_mode}
                  onChange={(e) => setNewProperty({ ...newProperty, has_consent_mode: e.target.checked })}
                />
                <span>Consent Mode 사용</span>
              </label>
              <span className="field-hint" style={{ marginLeft: '24px', fontSize: '12px', color: '#666' }}>
                사용자가 쿠키 거부 시 page_view 이벤트 부재를 정상으로 처리합니다
              </span>
            </div>
          </div>
          <div className="form-actions">
            <button onClick={handleAddNew} className="btn-primary">
              <Save size={18} />
              <span>저장</span>
            </button>
            <button onClick={() => setIsAddingNew(false)} className="btn-secondary">
              <X size={18} />
              <span>취소</span>
            </button>
          </div>
        </div>
      )}

      {/* 프로퍼티 목록 */}
      <div className="properties-list">
        <h2>프로퍼티 목록 ({properties.length}개)</h2>
        <div className="properties-table-wrapper">
          <table className="properties-table">
            <thead>
              <tr>
                <th>프로퍼티명</th>
                <th>URL</th>
                <th>GA4 ID</th>
                <th>GTM ID</th>
                <th>수집 여부</th>
                <th>Consent Mode</th>
                <th>작업</th>
              </tr>
            </thead>
            <tbody>
              {properties.map((property) => (
                <tr
                  key={property.id}
                  ref={(el) => propertyRowRefs.current[property.id] = el}
                  className={focusedPropertyId === property.id ? 'property-row-focused' : ''}
                >
                  {editingId === property.id ? (
                    // 편집 모드
                    <>
                      <td>
                        <input
                          type="text"
                          value={editForm.property_name}
                          onChange={(e) => setEditForm({ ...editForm, property_name: e.target.value })}
                          className="table-input"
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={editForm.url}
                          onChange={(e) => setEditForm({ ...editForm, url: e.target.value })}
                          className="table-input"
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={editForm.expected_ga4_id}
                          onChange={(e) => setEditForm({ ...editForm, expected_ga4_id: e.target.value })}
                          className="table-input"
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={editForm.expected_gtm_id}
                          onChange={(e) => setEditForm({ ...editForm, expected_gtm_id: e.target.value })}
                          className="table-input"
                        />
                      </td>
                      <td>
                        <label className="checkbox-label">
                          <input
                            type="checkbox"
                            checked={editForm.is_active}
                            onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })}
                          />
                          <span>{editForm.is_active ? '활성화' : '비활성화'}</span>
                        </label>
                      </td>
                      <td>
                        <label className="checkbox-label">
                          <input
                            type="checkbox"
                            checked={editForm.has_consent_mode}
                            onChange={(e) => setEditForm({ ...editForm, has_consent_mode: e.target.checked })}
                          />
                          <span>{editForm.has_consent_mode ? '사용' : '미사용'}</span>
                        </label>
                      </td>
                      <td>
                        <div className="table-actions">
                          <button onClick={() => handleSaveEdit(property.id)} className="btn-icon btn-save" title="저장">
                            <Save size={18} />
                          </button>
                          <button onClick={handleCancelEdit} className="btn-icon btn-cancel" title="취소">
                            <X size={18} />
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    // 읽기 모드
                    <>
                      <td className="property-name">{property.property_name}</td>
                      <td className="property-url">{property.url}</td>
                      <td>{property.expected_ga4_id || '-'}</td>
                      <td>{property.expected_gtm_id || '-'}</td>
                      <td>
                        <span className={`status-badge ${property.is_active ? 'active' : 'inactive'}`}>
                          {property.is_active ? '활성화' : '비활성화'}
                        </span>
                      </td>
                      <td>
                        <span className={`status-badge ${property.has_consent_mode ? 'consent-enabled' : 'consent-disabled'}`}>
                          {property.has_consent_mode ? '사용' : '미사용'}
                        </span>
                      </td>
                      <td>
                        <div className="table-actions">
                          <button
                            onClick={() => handleStartEdit(property)}
                            className="btn-icon"
                            title="수정"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button
                            onClick={() => handleDelete(property.id, property.property_name)}
                            className="btn-icon btn-danger"
                            title="삭제"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default SettingsPage;
