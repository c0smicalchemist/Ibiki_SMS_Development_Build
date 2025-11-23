export type Language = 'en' | 'zh';

export const translations: Record<Language, Record<string, string>> = {
  en: {
    // Common
    'common.loading': 'Loading…',
    'common.error': 'Error',
    'common.success': 'Success',
    'common.cancel': 'Cancel',
    'common.save': 'Save',
    'common.delete': 'Delete',
    'common.edit': 'Edit',
    'common.close': 'Close',
    'common.back': 'Back',
    'common.next': 'Next',
    'common.active': 'Active',
    'common.inactive': 'Inactive',
    'common.refresh': 'Refresh',

    // Admin tabs
    'admin.tabs.clients': 'Clients',
    'admin.tabs.configuration': 'Configuration',
    'admin.tabs.monitoring': 'Monitoring',
    'admin.tabs.webhook': 'Webhook Setup',
    'admin.tabs.testing': 'API Testing',
    'admin.tabs.logs': 'Error Logs',

    // Admin env & DB
    'admin.envDb.title': 'Environment & Database',
    'admin.envDb.runMigrations': 'Run Migrations',

    // Admin webhook
    'admin.webhook.suggestedUrl': 'Suggested Webhook URL (current environment)',
    'admin.webhook.configuredUrl': 'Configured Webhook URL',
    'admin.webhook.setToSuggested': 'Set to suggested',

    // Webhook docs
    'docs.webhook.title': 'Webhook Configuration (2-Way SMS)',
    'docs.webhook.description': 'Configure this webhook URL in your SMS provider to receive incoming messages',

    // Inbox
    'inbox.noMessages': 'No Messages Yet',
    'inbox.noMessagesDesc': 'Incoming SMS messages will appear here',

    // Message History table
    'messageHistory.table.recipient': 'Recipient',
    'messageHistory.table.message': 'Message',
    'messageHistory.table.type': 'Type',
    'messageHistory.table.status': 'Status',
    'messageHistory.table.date': 'Date',
    'messageHistory.table.cost': 'Cost',
    'messageHistory.table.actions': 'Actions',
  },
  zh: {
    // Common
    'common.loading': '加载中…',
    'common.error': '错误',
    'common.success': '成功',
    'common.cancel': '取消',
    'common.save': '保存',
    'common.delete': '删除',
    'common.edit': '编辑',
    'common.close': '关闭',
    'common.back': '返回',
    'common.next': '下一步',
    'common.active': '活跃',
    'common.inactive': '不活跃',
    'common.refresh': '刷新',

    // Admin tabs
    'admin.tabs.clients': '客户',
    'admin.tabs.configuration': '配置',
    'admin.tabs.monitoring': '监控',
    'admin.tabs.webhook': 'Webhook设置',
    'admin.tabs.testing': 'API测试',
    'admin.tabs.logs': '错误日志',

    // Admin env & DB
    'admin.envDb.title': '环境与数据库',
    'admin.envDb.runMigrations': '运行迁移',

    // Admin webhook
    'admin.webhook.suggestedUrl': '建议的Webhook URL（当前环境）',
    'admin.webhook.configuredUrl': '已配置的Webhook URL',
    'admin.webhook.setToSuggested': '设置为建议值',

    // Webhook docs
    'docs.webhook.title': 'Webhook配置（双向短信）',
    'docs.webhook.description': '请在短信服务商的控制台设置此Webhook URL以接收来信',

    // Inbox
    'inbox.noMessages': '暂无消息',
    'inbox.noMessagesDesc': '收到的短信将显示在这里',

    // Message History table
    'messageHistory.table.recipient': '接收方',
    'messageHistory.table.message': '消息',
    'messageHistory.table.type': '类型',
    'messageHistory.table.status': '状态',
    'messageHistory.table.date': '日期',
    'messageHistory.table.cost': '费用',
    'messageHistory.table.actions': '操作',
  }
};

export function translate(key: string, lang: Language): string {
  return (translations[lang] as Record<string, string>)[key] || key;
}
