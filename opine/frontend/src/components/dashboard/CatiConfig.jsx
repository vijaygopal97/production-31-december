import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle, RefreshCw, Save } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { catiAPI } from '../../services/api';

const DEFAULT_CONFIG = {
  enabledProviders: ['deepcall'],
  selectionMethod: 'switch',
  activeProvider: 'deepcall',
  fallbackProvider: 'deepcall',
  percentages: {
    deepcall: 100,
    cloudtelephony: 0
  }
};

const PROVIDERS = [
  { key: 'deepcall', label: 'DeepCall (Primary)' },
  { key: 'cloudtelephony', label: 'CloudTelephony (Backup)' }
];

const normalizeConfig = (cfg) => {
  const merged = {
    ...DEFAULT_CONFIG,
    ...(cfg || {})
  };

  const enabled = Array.isArray(merged.enabledProviders) && merged.enabledProviders.length > 0
    ? merged.enabledProviders
    : ['deepcall'];

  const pct = merged.percentages || {};
  const deepcallPct = Number.isFinite(pct.deepcall) ? pct.deepcall : parseInt(pct.deepcall || '0', 10) || 0;
  const cloudPct = Number.isFinite(pct.cloudtelephony) ? pct.cloudtelephony : parseInt(pct.cloudtelephony || '0', 10) || 0;

  return {
    enabledProviders: enabled,
    selectionMethod: merged.selectionMethod || 'switch',
    activeProvider: merged.activeProvider || enabled[0] || 'deepcall',
    fallbackProvider: merged.fallbackProvider || 'deepcall',
    percentages: {
      deepcall: Math.max(0, Math.min(100, deepcallPct)),
      cloudtelephony: Math.max(0, Math.min(100, cloudPct))
    }
  };
};

const CatiConfig = () => {
  const { showSuccess, showError } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [serverConfig, setServerConfig] = useState(null); // for "unsaved changes" detection

  const hasChanges = useMemo(() => {
    if (!serverConfig) return false;
    return JSON.stringify(serverConfig) !== JSON.stringify(config);
  }, [serverConfig, config]);

  const percentageTotal = useMemo(() => {
    const d = parseInt(config.percentages?.deepcall || '0', 10) || 0;
    const c = parseInt(config.percentages?.cloudtelephony || '0', 10) || 0;
    return d + c;
  }, [config.percentages]);

  const validation = useMemo(() => {
    const enabled = config.enabledProviders || [];
    if (!enabled.length) {
      return { ok: false, message: 'Select at least one provider.' };
    }

    if (config.selectionMethod === 'switch' && !enabled.includes(config.activeProvider)) {
      return { ok: false, message: 'Active provider must be one of the enabled providers.' };
    }

    if (config.selectionMethod === 'percentage') {
      if (percentageTotal <= 0) return { ok: false, message: 'Percentages must sum to > 0.' };
    }

    return { ok: true, message: '' };
  }, [config, percentageTotal]);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const res = await catiAPI.getProviderConfig();
      const normalized = normalizeConfig(res?.data);
      setConfig(normalized);
      setServerConfig(normalized);
    } catch (e) {
      showError(e?.response?.data?.message || e?.message || 'Failed to load CATI config');
      setConfig(DEFAULT_CONFIG);
      setServerConfig(DEFAULT_CONFIG);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleProvider = (providerKey) => {
    setConfig((prev) => {
      const enabled = new Set(prev.enabledProviders || []);
      if (enabled.has(providerKey)) enabled.delete(providerKey);
      else enabled.add(providerKey);
      const nextEnabled = Array.from(enabled);

      // Never allow empty enabledProviders in UI (safe)
      if (nextEnabled.length === 0) return prev;

      // Keep activeProvider valid
      let nextActive = prev.activeProvider;
      if (!nextEnabled.includes(nextActive)) nextActive = nextEnabled[0];

      return {
        ...prev,
        enabledProviders: nextEnabled,
        activeProvider: nextActive
      };
    });
  };

  const saveConfig = async () => {
    if (!validation.ok) {
      showError(validation.message);
      return;
    }

    setSaving(true);
    try {
      const payload = {
        enabledProviders: config.enabledProviders,
        selectionMethod: config.selectionMethod,
        activeProvider: config.activeProvider,
        fallbackProvider: config.fallbackProvider,
        percentages: config.percentages
      };
      const res = await catiAPI.updateProviderConfig(payload);
      const normalized = normalizeConfig(res?.data);
      setConfig(normalized);
      setServerConfig(normalized);
      showSuccess('CATI configuration updated successfully');
    } catch (e) {
      showError(e?.response?.data?.message || e?.message || 'Failed to update CATI config');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">CATI Config</h1>
          <p className="text-gray-600 mt-1">
            Control which CATI calling provider is used (switch / random / percentage split).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadConfig}
            disabled={loading || saving}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={saveConfig}
            disabled={loading || saving || !hasChanges}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-[#001D48] via-[#373177] to-[#3FADCC] text-white shadow hover:opacity-95 disabled:opacity-60"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {/* Status banner */}
      {!loading && (
        <div
          className={`rounded-lg border p-4 flex items-start gap-3 ${
            validation.ok ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
          }`}
        >
          {validation.ok ? (
            <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
          )}
          <div className="flex-1">
            <div className="font-semibold text-gray-900">
              {validation.ok ? 'Configuration looks good' : 'Fix required before saving'}
            </div>
            <div className="text-sm text-gray-700 mt-0.5">
              {validation.ok
                ? (hasChanges ? 'You have unsaved changes.' : 'No pending changes.')
                : validation.message}
            </div>
          </div>
        </div>
      )}

      {/* Form */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        {loading ? (
          <div className="text-gray-600">Loading configuration…</div>
        ) : (
          <div className="space-y-6">
            {/* Providers */}
            <div>
              <div className="text-sm font-semibold text-gray-900">Enabled providers</div>
              <div className="text-sm text-gray-600 mt-1">
                Select at least one provider. (CloudTelephony requires agent registration automatically.)
              </div>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                {PROVIDERS.map((p) => {
                  const checked = (config.enabledProviders || []).includes(p.key);
                  return (
                    <label
                      key={p.key}
                      className={`flex items-center justify-between p-4 rounded-lg border cursor-pointer ${
                        checked ? 'border-[#3FADCC] bg-[#E6F0F8]' : 'border-gray-200 bg-white'
                      }`}
                    >
                      <div>
                        <div className="font-semibold text-gray-900">{p.label}</div>
                        <div className="text-xs text-gray-600 mt-1">Key: {p.key}</div>
                      </div>
                      <input
                        type="checkbox"
                        className="h-5 w-5"
                        checked={checked}
                        onChange={() => toggleProvider(p.key)}
                      />
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Selection method */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-sm font-semibold text-gray-900">Selection method</div>
                <select
                  value={config.selectionMethod}
                  onChange={(e) => setConfig((prev) => ({ ...prev, selectionMethod: e.target.value }))}
                  className="mt-2 w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3FADCC]"
                >
                  <option value="switch">Switch (use active provider)</option>
                  <option value="random">Random</option>
                  <option value="percentage">Percentage split</option>
                </select>
              </div>

              <div>
                <div className="text-sm font-semibold text-gray-900">Active provider (Switch mode)</div>
                <select
                  value={config.activeProvider}
                  onChange={(e) => setConfig((prev) => ({ ...prev, activeProvider: e.target.value }))}
                  disabled={config.selectionMethod !== 'switch'}
                  className="mt-2 w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3FADCC] disabled:bg-gray-100"
                >
                  {(config.enabledProviders || []).map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Percentage split */}
            {config.selectionMethod === 'percentage' && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">Percentage split</div>
                    <div className="text-sm text-gray-600 mt-1">
                      Total: <span className={`font-semibold ${percentageTotal === 100 ? 'text-green-700' : 'text-yellow-700'}`}>{percentageTotal}%</span>
                      {percentageTotal !== 100 && (
                        <span className="ml-2 text-xs text-gray-600">(backend normalizes if total ≠ 100)</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700">DeepCall %</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={config.percentages.deepcall}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          percentages: { ...prev.percentages, deepcall: parseInt(e.target.value || '0', 10) }
                        }))
                      }
                      className="mt-2 w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3FADCC]"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700">CloudTelephony %</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={config.percentages.cloudtelephony}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          percentages: { ...prev.percentages, cloudtelephony: parseInt(e.target.value || '0', 10) }
                        }))
                      }
                      className="mt-2 w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3FADCC]"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Safety note */}
            <div className="text-xs text-gray-600">
              <span className="font-semibold">Safety:</span> This page does not expose provider credentials. Webhook URLs and secrets are managed on the backend/server.
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CatiConfig;


