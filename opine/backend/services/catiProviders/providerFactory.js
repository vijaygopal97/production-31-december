/**
 * ProviderFactory
 * Factory for creating and managing CATI calling provider instances.
 * 
 * Handles:
 * - Provider selection based on company configuration
 * - Provider instance creation and caching
 * - Fallback logic
 */

const CloudTelephonyProvider = require('./cloudtelephonyProvider');
const DeepCallProvider = require('./deepcallProvider');
const Company = require('../../models/Company');

class ProviderFactory {
  constructor() {
    // Cache provider instances per company (lightweight, no heavy state)
    this.providerCache = new Map();
  }

  /**
   * Get provider instance for a company
   * @param {String|ObjectId} companyId - Company ID
   * @param {Object} options - Selection options
   * @param {String} options.selectionKey - Optional key for consistent selection
   * @returns {Promise<{provider: BaseProvider, providerName: String}>}
   */
  async getProvider(companyId, options = {}) {
    try {
      // Get company configuration
      const company = await Company.findById(companyId).select('catiProviderConfig');
      
      if (!company) {
        throw new Error(`Company ${companyId} not found`);
      }

      const config = company.catiProviderConfig || {};
      const enabledProviders = config.enabledProviders || ['deepcall'];
      const selectionMethod = config.selectionMethod || 'switch';
      const activeProvider = config.activeProvider || 'deepcall';
      const fallbackProvider = config.fallbackProvider || 'deepcall';
      const percentages = config.percentages || { deepcall: 100, cloudtelephony: 0 };

      // Select provider based on method
      let selectedProviderName;
      
      if (selectionMethod === 'switch') {
        // Simple switch: use activeProvider
        selectedProviderName = activeProvider;
      } else if (selectionMethod === 'random') {
        // Random selection from enabled providers
        const available = enabledProviders.filter(p => ['deepcall', 'cloudtelephony'].includes(p));
        selectedProviderName = available[Math.floor(Math.random() * available.length)] || fallbackProvider;
      } else if (selectionMethod === 'percentage') {
        // Percentage-based selection
        const rand = Math.random() * 100;
        let cumulative = 0;
        
        for (const providerName of ['deepcall', 'cloudtelephony']) {
          if (!enabledProviders.includes(providerName)) continue;
          
          const pct = percentages[providerName] || 0;
          cumulative += pct;
          
          if (rand < cumulative) {
            selectedProviderName = providerName;
            break;
          }
        }
        
        // Fallback if no provider selected
        if (!selectedProviderName) {
          selectedProviderName = enabledProviders[0] || fallbackProvider;
        }
      } else {
        // Default: use activeProvider
        selectedProviderName = activeProvider;
      }

      // Ensure selected provider is enabled
      if (!enabledProviders.includes(selectedProviderName)) {
        console.warn(`⚠️  Selected provider ${selectedProviderName} not enabled, using fallback: ${fallbackProvider}`);
        selectedProviderName = fallbackProvider;
      }

      // Get or create provider instance
      const cacheKey = `${companyId}_${selectedProviderName}`;
      
      if (!this.providerCache.has(cacheKey)) {
        const provider = this.createProvider(selectedProviderName, config.providersConfig || {});
        this.providerCache.set(cacheKey, provider);
      }

      const provider = this.providerCache.get(cacheKey);

      return {
        provider,
        providerName: selectedProviderName
      };
    } catch (error) {
      console.error('Error in ProviderFactory.getProvider:', error);
      
      // Fallback to DeepCall if factory fails
      const fallback = this.createProvider('deepcall', {});
      return {
        provider: fallback,
        providerName: 'deepcall'
      };
    }
  }

  /**
   * Create a provider instance
   * @param {String} providerName - 'deepcall' or 'cloudtelephony'
   * @param {Object} config - Provider-specific configuration
   * @returns {BaseProvider}
   */
  createProvider(providerName, config = {}) {
    switch (providerName) {
      case 'deepcall':
        return new DeepCallProvider(config);
      
      case 'cloudtelephony':
        return new CloudTelephonyProvider(config);
      
      default:
        console.warn(`Unknown provider: ${providerName}, defaulting to deepcall`);
        return new DeepCallProvider(config);
    }
  }

  /**
   * Clear provider cache (useful for testing or config changes)
   */
  clearCache() {
    this.providerCache.clear();
  }
}

// Export singleton instance
module.exports = new ProviderFactory();

