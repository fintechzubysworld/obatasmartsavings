/**
 * OBATA SMART SAVINGS - Storage Manager v2.3
 * Handles all data persistence with automatic backups
 */

class StorageManager {
  constructor() {
    this.storagePrefix = 'obata_v2_';
    this.currentData = null;
    this.backupInterval = null;
  }

  // Initialize storage system
  async initialize() {
    console.log('📦 Storage Manager Initializing...');
    
    // Load existing data or create new
    await this.loadAllData();
    
    // Setup auto-backup every 5 minutes
    this.setupAutoBackup(5 * 60 * 1000);
    
    // Setup data export on page unload
    window.addEventListener('beforeunload', () => this.exportAllData());
    
    console.log('✅ Storage Manager Ready');
    return this.currentData;
  }

  // Load all data from localStorage
  async loadAllData() {
    try {
      const data = {
        settings: this.load('settings') || this.getDefaultSettings(),
        users: this.load('users') || this.getDefaultUsers(),
        customers: this.load('customers') || [],
        transactions: this.load('transactions') || [],
        loans: this.load('loans') || [],
        backup_history: this.load('backup_history') || [],
        audit_log: this.load('audit_log') || [],
        metadata: this.load('metadata') || this.getDefaultMetadata()
      };
      
      this.currentData = data;
      return data;
    } catch (error) {
      console.error('❌ Error loading data:', error);
      return this.createDefaultData();
    }
  }

  // Save all data to localStorage
  async saveAllData(data = null) {
    try {
      const saveData = data || this.currentData;
      
      if (!saveData) {
        console.warn('⚠️ No data to save');
        return;
      }

      // Update metadata
      saveData.metadata = {
        total_customers: saveData.customers.length,
        total_transactions: saveData.transactions.length,
        total_savings: this.calculateTotalSavings(saveData.customers),
        total_loans: this.calculateTotalLoans(saveData.loans),
        last_customer_id: this.getLastId(saveData.customers, 'id'),
        last_transaction_id: this.getLastId(saveData.transactions, 'txId'),
        last_updated: new Date().toISOString()
      };

      // Save each component separately
      this.save('settings', saveData.settings);
      this.save('users', saveData.users);
      this.save('customers', saveData.customers);
      this.save('transactions', saveData.transactions);
      this.save('loans', saveData.loans);
      this.save('backup_history', saveData.backup_history);
      this.save('audit_log', saveData.audit_log);
      this.save('metadata', saveData.metadata);

      // Create audit log entry
      await this.logAudit('DATA_SAVED', {
        timestamp: new Date().toISOString(),
        items_saved: saveData.metadata.total_customers + saveData.metadata.total_transactions,
        user: 'system'
      });

      console.log('💾 Data saved successfully');
      return true;
    } catch (error) {
      console.error('❌ Error saving data:', error);
      return false;
    }
  }

  // Export all data as JSON file
  async exportAllData() {
    try {
      const data = {
        schema_version: "2.3",
        export_date: new Date().toISOString(),
        data: this.currentData,
        checksum: this.generateChecksum(this.currentData)
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `obata_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Log backup
      await this.logBackup('manual', data);
      
      console.log('📤 Data exported successfully');
      return true;
    } catch (error) {
      console.error('❌ Error exporting data:', error);
      return false;
    }
  }

  // Import data from JSON file
  async importData(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = async (event) => {
        try {
          const importedData = JSON.parse(event.target.result);
          
          // Validate imported data
          if (!this.validateImportData(importedData)) {
            reject(new Error('Invalid backup file format'));
            return;
          }

          // Backup current data before import
          await this.createBackup('pre_import_backup');

          // Merge imported data with existing data
          this.currentData = this.mergeData(this.currentData, importedData.data);

          // Save imported data
          await this.saveAllData();

          // Log import
          await this.logAudit('DATA_IMPORTED', {
            timestamp: new Date().toISOString(),
            source: 'file',
            items_imported: importedData.data.metadata?.total_customers || 0,
            user: 'system'
          });

          console.log('📥 Data imported successfully');
          resolve(true);
        } catch (error) {
          console.error('❌ Error importing data:', error);
          reject(error);
        }
      };

      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  // Setup automatic backup
  setupAutoBackup(interval = 5 * 60 * 1000) {
    if (this.backupInterval) {
      clearInterval(this.backupInterval);
    }

    this.backupInterval = setInterval(async () => {
      await this.createBackup('auto_backup');
    }, interval);

    console.log(`⏰ Auto-backup scheduled every ${interval / 60000} minutes`);
  }

  // Create a backup
  async createBackup(type = 'manual') {
    try {
      const backup = {
        type,
        timestamp: new Date().toISOString(),
        data: { ...this.currentData },
        metadata: {
          customers: this.currentData.customers.length,
          transactions: this.currentData.transactions.length,
          users: this.currentData.users.length
        }
      };

      // Add to backup history
      this.currentData.backup_history.unshift(backup);

      // Keep only last 50 backups
      if (this.currentData.backup_history.length > 50) {
        this.currentData.backup_history = this.currentData.backup_history.slice(0, 50);
      }

      // Save to localStorage
      this.save('backup_history', this.currentData.backup_history);

      console.log(`💾 ${type} created`);
      return backup;
    } catch (error) {
      console.error('❌ Error creating backup:', error);
      return null;
    }
  }

  // Restore from backup
  async restoreBackup(backupIndex) {
    try {
      if (!this.currentData.backup_history[backupIndex]) {
        throw new Error('Backup not found');
      }

      const backup = this.currentData.backup_history[backupIndex];
      
      // Create pre-restore backup
      await this.createBackup('pre_restore_backup');

      // Restore data
      this.currentData = backup.data;
      await this.saveAllData();

      // Log restore
      await this.logAudit('BACKUP_RESTORED', {
        timestamp: new Date().toISOString(),
        backup_timestamp: backup.timestamp,
        user: 'system'
      });

      console.log('🔄 Backup restored successfully');
      return true;
    } catch (error) {
      console.error('❌ Error restoring backup:', error);
      return false;
    }
  }

  // Helper methods
  load(key) {
    const item = localStorage.getItem(this.storagePrefix + key);
    return item ? JSON.parse(item) : null;
  }

  save(key, value) {
    localStorage.setItem(this.storagePrefix + key, JSON.stringify(value));
  }

  remove(key) {
    localStorage.removeItem(this.storagePrefix + key);
  }

  clearAll() {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith(this.storagePrefix)) {
        localStorage.removeItem(key);
      }
    });
    
    this.currentData = this.createDefaultData();
    console.log('🧹 All data cleared');
  }

  // Data validation and merging
  validateImportData(data) {
    return data && 
           data.schema_version === "2.3" &&
           data.data && 
           data.data.customers !== undefined &&
           data.data.transactions !== undefined;
  }

  mergeData(existing, imported) {
    // Merge customers (avoid duplicates by ID)
    const mergedCustomers = [...existing.customers];
    imported.customers.forEach(customer => {
      if (!mergedCustomers.find(c => c.id === customer.id)) {
        mergedCustomers.push(customer);
      }
    });

    // Merge transactions (avoid duplicates by txId)
    const mergedTransactions = [...existing.transactions];
    imported.transactions.forEach(transaction => {
      if (!mergedTransactions.find(t => t.txId === transaction.txId)) {
        mergedTransactions.push(transaction);
      }
    });

    // Merge users (avoid duplicates by username)
    const mergedUsers = [...existing.users];
    imported.users.forEach(user => {
      if (!mergedUsers.find(u => u.username === user.username)) {
        mergedUsers.push(user);
      }
    });

    return {
      ...existing,
      customers: mergedCustomers,
      transactions: mergedTransactions,
      users: mergedUsers,
      settings: { ...existing.settings, ...imported.settings },
      loans: [...existing.loans, ...imported.loans].filter((v, i, a) => 
        a.findIndex(t => t.loanId === v.loanId) === i
      )
    };
  }

  // Calculate statistics
  calculateTotalSavings(customers) {
    return customers.reduce((total, customer) => {
      return total + (customer.balance || 0);
    }, 0);
  }

  calculateTotalLoans(loans) {
    const activeLoans = loans.filter(loan => loan.status === 'active');
    return activeLoans.reduce((total, loan) => total + loan.amount_outstanding, 0);
  }

  getLastId(array, idField) {
    if (!array || array.length === 0) return 100;
    const ids = array.map(item => parseInt(item[idField]) || 0);
    return Math.max(...ids, 100);
  }

  // Audit logging
  async logAudit(action, details) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      action,
      details,
      user_agent: navigator.userAgent
    };

    this.currentData.audit_log.unshift(logEntry);
    
    // Keep only last 1000 audit logs
    if (this.currentData.audit_log.length > 1000) {
      this.currentData.audit_log = this.currentData.audit_log.slice(0, 1000);
    }

    this.save('audit_log', this.currentData.audit_log);
  }

  async logBackup(type, backupData) {
    const backupLog = {
      type,
      timestamp: new Date().toISOString(),
      size: JSON.stringify(backupData).length,
      items: {
        customers: backupData.data.customers?.length || 0,
        transactions: backupData.data.transactions?.length || 0,
        users: backupData.data.users?.length || 0
      }
    };

    this.currentData.backup_history.unshift(backupLog);
    this.save('backup_history', this.currentData.backup_history);
  }

  generateChecksum(data) {
    const str = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }

  // Default data templates
  getDefaultSettings() {
    return {
      app_name: "OBATA SMART SAVINGS",
      currency: "₦",
      default_interest_rate: 5.0,
      minimum_savings: 100,
      maximum_loan_multiplier: 2.0,
      auto_backup_interval: "daily",
      backup_retention_days: 30,
      theme: "light",
      language: "en",
      date_format: "dd/mm/yyyy",
      timezone: "Africa/Lagos"
    };
  }

  getDefaultUsers() {
    return [{
      id: 1,
      username: "Admin",
      password_hash: "admin123",
      name: "Administrator",
      role: "admin",
      permissions: {
        member_creation: true,
        transaction_posting: true,
        withdrawal: true,
        loan_management: true,
        account_closure: true,
        account_reactivation: true,
        view_statements: true,
        search_customers: true,
        generate_reports: true,
        manage_users: true,
        import_export: true,
        system_settings: true,
        drive_management: true
      },
      created: new Date().toISOString(),
      last_login: null,
      active: true
    }];
  }

  getDefaultMetadata() {
    return {
      total_customers: 0,
      total_transactions: 0,
      total_savings: 0,
      total_loans: 0,
      last_customer_id: 100,
      last_transaction_id: 1000,
      last_updated: new Date().toISOString()
    };
  }

  createDefaultData() {
    return {
      settings: this.getDefaultSettings(),
      users: this.getDefaultUsers(),
      customers: [],
      transactions: [],
      loans: [],
      backup_history: [],
      audit_log: [],
      metadata: this.getDefaultMetadata()
    };
  }
}

// Export as global object
window.StorageManager = StorageManager;