/**
 * Data Migration Utility v2.2 → v2.3
 * Run this once to migrate old data to new format
 */

class DataMigrator {
  constructor() {
    this.oldPrefix = 'obata_';
    this.newPrefix = 'obata_v2_';
  }
  
  async migrate() {
    console.log('🔄 Starting data migration from v2.2 to v2.3...');
    
    // Check if migration is needed
    if (this.isAlreadyMigrated()) {
      console.log('✅ Data already migrated');
      return true;
    }
    
    try {
      // Load old data
      const oldData = this.loadOldData();
      
      if (!oldData) {
        console.log('ℹ️ No old data found to migrate');
        return true;
      }
      
      // Transform data
      const newData = this.transformData(oldData);
      
      // Save new data
      this.saveNewData(newData);
      
      // Archive old data
      this.archiveOldData();
      
      console.log('✅ Migration completed successfully!');
      alert('✅ Data migration completed!\n\n' +
            'Old data has been archived and new data format is ready.');
      return true;
    } catch (error) {
      console.error('❌ Migration failed:', error);
      alert('Migration failed: ' + error.message);
      return false;
    }
  }
  
  loadOldData() {
    const data = {};
    
    // Load from localStorage
    const oldKeys = [
      'auth',
      'members',
      'ledger',
      'last_id',
      'users',
      'settings'
    ];
    
    oldKeys.forEach(key => {
      const fullKey = this.oldPrefix + key;
      const item = localStorage.getItem(fullKey);
      if (item) {
        data[key] = JSON.parse(item);
      }
    });
    
    return Object.keys(data).length > 0 ? data : null;
  }
  
  transformData(oldData) {
    // Transform customers
    const customers = [];
    if (oldData.members) {
      Object.keys(oldData.members).forEach(id => {
        const member = oldData.members[id];
        customers.push({
          id: parseInt(id),
          name: member.name || '',
          phone: member.phone || '',
          email: member.email || '',
          address: member.address || '',
          date_joined: member.date || new Date().toISOString().split('T')[0],
          status: member.active === false ? 'inactive' : 'active',
          balance_savings: this.calculateSavingsBalance(id, oldData.ledger),
          balance_loans: this.calculateLoanBalance(id, oldData.ledger),
          closure_date: member.closureDate || null,
          closure_reason: member.closureReason || '',
          created_by: member.createdBy || 'system',
          last_updated: new Date().toISOString()
        });
      });
    }
    
    // Transform transactions
    const transactions = [];
    if (oldData.ledger) {
      oldData.ledger.forEach(tx => {
        transactions.push({
          txId: tx.txId || Date.now() + Math.random(),
          customer_id: parseInt(tx.cust),
          type: tx.type,
          amount: tx.amount,
          date: tx.date || new Date().toISOString(),
          value_date: tx.valueDate || tx.date || new Date().toISOString(),
          status: tx.reversed ? 'reversed' : 'completed',
          processed_by: tx.processedBy || 'system',
          reference: tx.ref || '',
          notes: tx.notes || '',
          reversal_of: tx.reversed ? tx.txId : null
        });
      });
    }
    
    // Transform users
    const users = [];
    if (oldData.users && oldData.users.length > 0) {
      oldData.users.forEach(user => {
        users.push({
          id: user.id || this.generateId(),
          username: user.username,
          password_hash: user.password,
          name: user.name,
          role: user.role,
          permissions: user.permissions || this.getDefaultPermissions(user.role),
          created: user.created || new Date().toISOString(),
          created_by: user.createdBy || 'system',
          last_login: user.lastLogin || null,
          active: user.active !== false
        });
      });
    }
    
    // Transform settings
    const settings = {
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
    
    // Merge with old settings if they exist
    if (oldData.settings) {
      Object.assign(settings, oldData.settings);
    }
    
    return {
      settings,
      users,
      customers,
      transactions,
      loans: [],
      backup_history: [],
      audit_log: [],
      metadata: {
        total_customers: customers.length,
        total_transactions: transactions.length,
        total_savings: this.calculateTotalSavings(customers),
        total_loans: 0,
        last_customer_id: oldData.last_id || 100,
        last_transaction_id: 1000,
        last_updated: new Date().toISOString(),
        migration_version: "2.2_to_2.3",
        migration_date: new Date().toISOString()
      }
    };
  }
  
  saveNewData(data) {
    const storage = new StorageManager();
    storage.currentData = data;
    storage.saveAllData();
  }
  
  archiveOldData() {
    // Create archive of old data
    const archive = {};
    const oldKeys = [
      'auth',
      'members',
      'ledger',
      'last_id',
      'users',
      'settings'
    ];
    
    oldKeys.forEach(key => {
      const fullKey = this.oldPrefix + key;
      const item = localStorage.getItem(fullKey);
      if (item) {
        archive[key] = JSON.parse(item);
        // Remove from localStorage
        localStorage.removeItem(fullKey);
      }
    });
    
    // Save archive
    localStorage.setItem(this.newPrefix + 'archive_v22', JSON.stringify(archive));
    console.log('📦 Old data archived');
  }
  
  isAlreadyMigrated() {
    return localStorage.getItem(this.newPrefix + 'settings') !== null ||
           localStorage.getItem(this.newPrefix + 'archive_v22') !== null;
  }
  
  // Helper methods
  calculateSavingsBalance(customerId, ledger) {
    if (!ledger) return 0;
    
    const customerTxs = ledger.filter(tx => 
      tx.cust.toString() === customerId.toString() && 
      !tx.reversed
    );
    
    let balance = 0;
    customerTxs.forEach(tx => {
      if (['DAILY', 'WEEKLY', 'MONTHLY'].includes(tx.type)) {
        balance += tx.amount;
      } else if (tx.type === 'WITHDRAWAL') {
        balance -= tx.amount;
      }
    });
    
    return balance;
  }
  
  calculateLoanBalance(customerId, ledger) {
    if (!ledger) return 0;
    
    const customerTxs = ledger.filter(tx => 
      tx.cust.toString() === customerId.toString() && 
      !tx.reversed
    );
    
    let balance = 0;
    customerTxs.forEach(tx => {
      if (tx.type === 'LOAN') {
        balance += tx.amount;
      } else if (tx.type === 'LOAN_REPAY') {
        balance -= tx.amount;
      }
    });
    
    return balance;
  }
  
  calculateTotalSavings(customers) {
    return customers.reduce((total, customer) => 
      total + (customer.balance_savings || 0), 0);
  }
  
  generateId() {
    return Math.floor(Math.random() * 1000000) + 1;
  }
  
  getDefaultPermissions(role) {
    const basePermissions = {
      member_creation: false,
      transaction_posting: false,
      withdrawal: false,
      loan_management: false,
      account_closure: false,
      account_reactivation: false,
      view_statements: false,
      search_customers: false,
      generate_reports: false,
      manage_users: false,
      import_export: false,
      system_settings: false,
      drive_management: false
    };
    
    if (role === 'admin') {
      Object.keys(basePermissions).forEach(key => {
        basePermissions[key] = true;
      });
    } else if (role === 'supervisor') {
      basePermissions.member_creation = true;
      basePermissions.transaction_posting = true;
      basePermissions.withdrawal = true;
      basePermissions.loan_management = true;
      basePermissions.account_closure = true;
      basePermissions.account_reactivation = true;
      basePermissions.view_statements = true;
      basePermissions.search_customers = true;
      basePermissions.generate_reports = true;
    } else if (role === 'thrift_collector') {
      basePermissions.member_creation = true;
      basePermissions.transaction_posting = true;
      basePermissions.withdrawal = true;
      basePermissions.loan_management = true;
      basePermissions.view_statements = true;
      basePermissions.search_customers = true;
    }
    
    return basePermissions;
  }
}

// Auto-run migration if needed
document.addEventListener('DOMContentLoaded', async function() {
  // Check if we should run migration
  const hasOldData = localStorage.getItem('obata_members') !== null;
  const hasNewData = localStorage.getItem('obata_v2_settings') !== null;
  
  if (hasOldData && !hasNewData) {
    const shouldMigrate = confirm(
      '🔧 Data Migration Required\n\n' +
      'Old data format detected. Would you like to migrate to the new format?\n\n' +
      'This will:\n' +
      '1. Convert all data to new format\n' +
      '2. Backup old data\n' +
      '3. Enable new features\n\n' +
      'Click OK to migrate, Cancel to continue with old format.'
    );
    
    if (shouldMigrate) {
      const migrator = new DataMigrator();
      await migrator.migrate();
      // Reload page to use new data
      location.reload();
    }
  }
});

// Export
window.DataMigrator = DataMigrator;