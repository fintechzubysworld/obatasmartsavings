/**
 * Standalone Backup Utility for OBATA SMART SAVINGS
 * Run this separately to backup your data
 */

(function() {
  'use strict';
  
  class BackupUtility {
    constructor() {
      this.storagePrefix = 'obata_v2_';
      this.keys = [
        'settings',
        'users',
        'customers',
        'transactions',
        'loans',
        'backup_history',
        'audit_log',
        'metadata'
      ];
    }
    
    // Create backup
    backup() {
      try {
        const data = {};
        
        // Collect all data
        this.keys.forEach(key => {
          const item = localStorage.getItem(this.storagePrefix + key);
          if (item) {
            data[key] = JSON.parse(item);
          }
        });
        
        // Create backup object
        const backup = {
          schema_version: "2.3",
          backup_date: new Date().toISOString(),
          data: data,
          system_info: {
            user_agent: navigator.userAgent,
            platform: navigator.platform,
            language: navigator.language,
            cookies_enabled: navigator.cookieEnabled,
            storage_usage: this.getStorageUsage()
          }
        };
        
        // Save backup to file
        this.saveToFile(backup);
        return backup;
      } catch (error) {
        console.error('Backup failed:', error);
        alert('Backup failed: ' + error.message);
      }
    }
    
    // Restore from backup
    restore(file) {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const backup = JSON.parse(e.target.result);
          
          if (!this.validateBackup(backup)) {
            throw new Error('Invalid backup file');
          }
          
          // Confirm restore
          if (!confirm('This will overwrite all current data. Continue?')) {
            return;
          }
          
          // Restore data
          Object.keys(backup.data).forEach(key => {
            localStorage.setItem(this.storagePrefix + key, JSON.stringify(backup.data[key]));
          });
          
          alert('✅ Data restored successfully!\n\nBackup from: ' + 
                new Date(backup.backup_date).toLocaleString());
          
          // Reload page
          setTimeout(() => location.reload(), 1000);
        } catch (error) {
          alert('Restore failed: ' + error.message);
        }
      };
      
      reader.readAsText(file);
    }
    
    // Save backup to file
    saveToFile(data) {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      
      a.href = url;
      a.download = `obata_backup_${new Date().toISOString().slice(0,19).replace(/:/g,'-')}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      alert('✅ Backup created successfully!\n\n' + 
            `File: ${a.download}\n` +
            `Size: ${blob.size} bytes\n` +
            `Customers: ${data.data.customers?.length || 0}\n` +
            `Transactions: ${data.data.transactions?.length || 0}`);
    }
    
    // Validate backup file
    validateBackup(backup) {
      return backup && 
             backup.schema_version === "2.3" &&
             backup.data &&
             backup.backup_date &&
             (backup.data.customers || backup.data.transactions);
    }
    
    // Get storage usage
    getStorageUsage() {
      let total = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith(this.storagePrefix)) {
          total += localStorage.getItem(key).length;
        }
      }
      return total;
    }
    
    // Create HTML interface
    createInterface() {
      const container = document.createElement('div');
      container.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        padding: 30px;
        border-radius: 15px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        z-index: 9999;
        font-family: Arial, sans-serif;
        min-width: 400px;
        text-align: center;
      `;
      
      const title = document.createElement('h2');
      title.textContent = '🔐 OBATA SMART SAVINGS - Data Backup Utility';
      title.style.margin = '0 0 20px 0';
      title.style.color = '#1e88e5';
      
      const backupBtn = document.createElement('button');
      backupBtn.textContent = '💾 Create Backup';
      backupBtn.style.cssText = `
        display: block;
        width: 100%;
        padding: 15px;
        margin: 10px 0;
        background: #1e88e5;
        color: white;
        border: none;
        border-radius: 8px;
        font-size: 16px;
        cursor: pointer;
        transition: background 0.3s;
      `;
      backupBtn.onmouseover = () => backupBtn.style.background = '#1565c0';
      backupBtn.onmouseout = () => backupBtn.style.background = '#1e88e5';
      backupBtn.onclick = () => this.backup();
      
      const restoreLabel = document.createElement('label');
      restoreLabel.textContent = '🔄 Restore from Backup File:';
      restoreLabel.style.display = 'block';
      restoreLabel.style.margin = '20px 0 10px';
      restoreLabel.style.fontWeight = 'bold';
      
      const restoreInput = document.createElement('input');
      restoreInput.type = 'file';
      restoreInput.accept = '.json';
      restoreInput.style.cssText = `
        display: block;
        width: 100%;
        padding: 10px;
        margin: 10px 0;
        border: 2px dashed #1e88e5;
        border-radius: 8px;
        cursor: pointer;
      `;
      restoreInput.onchange = (e) => this.restore(e.target.files[0]);
      
      const info = document.createElement('div');
      info.style.marginTop = '20px';
      info.style.padding = '15px';
      info.style.background = '#f5f7fa';
      info.style.borderRadius = '8px';
      info.style.fontSize = '14px';
      info.style.textAlign = 'left';
      
      const usage = this.getStorageUsage();
      info.innerHTML = `
        <strong>📊 Current Data Status:</strong><br>
        • Storage used: ${(usage / 1024).toFixed(2)} KB<br>
        • Max storage: ${(5 * 1024).toFixed(2)} KB (5MB limit)<br>
        • Items in storage: ${localStorage.length}<br><br>
        <strong>💡 Tip:</strong> Backup regularly to prevent data loss!
      `;
      
      container.appendChild(title);
      container.appendChild(backupBtn);
      container.appendChild(restoreLabel);
      container.appendChild(restoreInput);
      container.appendChild(info);
      
      document.body.appendChild(container);
      
      // Add overlay
      const overlay = document.createElement('div');
      overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.7);
        z-index: 9998;
      `;
      document.body.appendChild(overlay);
      
      // Close button
      const closeBtn = document.createElement('button');
      closeBtn.textContent = '✕';
      closeBtn.style.cssText = `
        position: absolute;
        top: 10px;
        right: 10px;
        background: #ff4444;
        color: white;
        border: none;
        border-radius: 50%;
        width: 30px;
        height: 30px;
        cursor: pointer;
        font-size: 16px;
        line-height: 1;
      `;
      closeBtn.onclick = () => {
        document.body.removeChild(container);
        document.body.removeChild(overlay);
      };
      container.appendChild(closeBtn);
    }
  }
  
  // Auto-run when included
  document.addEventListener('DOMContentLoaded', function() {
    // Add backup link to page
    const backupLink = document.createElement('a');
    backupLink.href = '#';
    backupLink.textContent = '🔧 Backup Utility';
    backupLink.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: #1e88e5;
      color: white;
      padding: 10px 15px;
      border-radius: 20px;
      text-decoration: none;
      font-size: 14px;
      z-index: 1000;
      box-shadow: 0 3px 10px rgba(0,0,0,0.2);
    `;
    backupLink.onclick = (e) => {
      e.preventDefault();
      new BackupUtility().createInterface();
    };
    
    document.body.appendChild(backupLink);
  });
  
  // Export to window
  window.BackupUtility = BackupUtility;
})();