export type Language = 'en' | 'zh';

export const translations = {
  en: {
    // Landing Page
    'landing.title': 'Ibiki SMS',
    'landing.subtitle': 'Secure, scalable SMS gateway for your business needs',
    'landing.features.secure': 'Secure API Access',
    'landing.features.secureDesc': 'Enterprise-grade security with encrypted API keys',
    'landing.features.flexible': 'Flexible Pricing',
    'landing.features.flexibleDesc': 'Transparent, pay-as-you-go pricing model',
    'landing.features.complete': 'Complete Coverage',
    'landing.features.completeDesc': 'Full SMS API with delivery tracking and reports',
    'landing.cta': 'Get Started',
    'landing.login': 'Login',
    
    // Navigation
    'nav.home': 'Home',
    'nav.dashboard': 'Dashboard',
    'nav.docs': 'Documentation',
    'nav.admin': 'Admin',
    'nav.login': 'Login',
    'nav.signup': 'Sign Up',
    'nav.logout': 'Logout',
    
    // Auth
    'auth.signup.title': 'Create Your Account',
    'auth.signup.subtitle': 'Start sending SMS through our API',
    'auth.signup.name': 'Full Name',
    'auth.signup.email': 'Email Address',
    'auth.signup.company': 'Company Name',
    'auth.signup.password': 'Password',
    'auth.signup.confirmPassword': 'Confirm Password',
    'auth.signup.submit': 'Create Account',
    'auth.signup.hasAccount': 'Already have an account?',
    'auth.signup.loginLink': 'Sign in',
    
    'auth.login.title': 'Welcome Back',
    'auth.login.subtitle': 'Sign in to access your account',
    'auth.login.email': 'Email Address',
    'auth.login.password': 'Password',
    'auth.login.submit': 'Sign In',
    'auth.login.noAccount': "Don't have an account?",
    'auth.login.signupLink': 'Sign up',
    
    // Dashboard
    'dashboard.title': 'Dashboard',
    'dashboard.subtitle': 'Monitor your SMS API usage and performance',
    'dashboard.stats.messages': 'Total Messages Sent',
    'dashboard.stats.credits': 'Available Credits',
    'dashboard.stats.status': 'API Status',
    'dashboard.stats.online': 'Online',
    'dashboard.stats.allTime': 'All time',
    'dashboard.stats.balance': 'Current balance',
    'dashboard.apiKey.title': 'Your API Credentials',
    'dashboard.apiKey.description': 'Use this key to authenticate all API requests',
    'dashboard.buttons.viewDocs': 'View API Documentation',
    'dashboard.buttons.addCredits': 'Add Credits',
    'dashboard.addCredits.success': 'Credits added successfully',
    'dashboard.addCredits.successDesc': 'Your credit balance has been updated',
    'dashboard.addCredits.error': 'Failed to add credits',
    
    // Admin Dashboard
    'admin.title': 'Admin Dashboard',
    'admin.subtitle': 'Manage clients and system configuration',
    'admin.stats.totalClients': 'Total Clients',
    'admin.stats.activeAccounts': 'Active accounts',
    'admin.stats.totalMessages': 'Total Messages',
    'admin.stats.last30Days': 'Last 30 days',
    'admin.stats.systemStatus': 'System Status',
    'admin.stats.healthy': 'Healthy',
    'admin.stats.allRunning': 'All services running',
    
    'admin.tabs.clients': 'Clients',
    'admin.tabs.configuration': 'Configuration',
    'admin.tabs.monitoring': 'Monitoring',
    
    'admin.clients.title': 'Client Management',
    'admin.clients.subtitle': 'View and manage all connected clients',
    'admin.clients.table.name': 'Client Name',
    'admin.clients.table.email': 'Email',
    'admin.clients.table.apiKey': 'API Key',
    'admin.clients.table.status': 'Status',
    'admin.clients.table.messages': 'Messages Sent',
    'admin.clients.table.lastActive': 'Last Active',
    'admin.clients.table.actions': 'Actions',
    'admin.clients.status.active': 'active',
    'admin.clients.status.inactive': 'inactive',
    'admin.clients.actions.view': 'View',
    
    'admin.config.title': 'ExtremeSMS Configuration',
    'admin.config.subtitle': 'Configure your ExtremeSMS integration and pricing',
    'admin.config.apiKey.label': 'ExtremeSMS API Key',
    'admin.config.apiKey.placeholder': 'Enter your ExtremeSMS API key',
    'admin.config.pricing.title': 'Pricing Configuration',
    'admin.config.pricing.extreme.label': 'ExtremeSMS Cost',
    'admin.config.pricing.extreme.description': 'Cost per SMS from ExtremeSMS',
    'admin.config.pricing.client.label': 'Client Rate',
    'admin.config.pricing.client.description': 'Rate charged to your clients',
    'admin.config.pricing.margin.label': 'Profit Margin',
    'admin.config.pricing.margin.perSms': 'per SMS',
    'admin.config.buttons.save': 'Save Configuration',
    'admin.config.buttons.test': 'Test Connection',
    
    // API Documentation
    'docs.title': 'API Documentation',
    'docs.subtitle': 'Complete reference for the Ibiki SMS API v2.0',
    'docs.authentication.title': 'Authentication',
    'docs.authentication.strong': 'Authentication:',
    'docs.authentication.description': 'All API requests require your API key in the Authorization header:',
    'docs.endpoints.title': 'Endpoints',
    
    // Send Single SMS
    'docs.sendSingle.title': 'Send Single SMS',
    'docs.sendSingle.description': 'Send an SMS to a single recipient. Returns immediately with message ID.',
    
    // Send Bulk SMS
    'docs.sendBulk.title': 'Send Bulk SMS (Same Message)',
    'docs.sendBulk.description': 'Send the same SMS message to multiple recipients at once.',
    
    // Send Bulk Multi
    'docs.sendBulkMulti.title': 'Send Bulk SMS (Different Messages)',
    'docs.sendBulkMulti.description': 'Send different SMS messages to multiple recipients in a single request.',
    
    // Check Delivery
    'docs.checkDelivery.title': 'Check Message Delivery Status',
    'docs.checkDelivery.description': 'Get the delivery status of a previously sent message using its message ID.',
    
    // Check Balance
    'docs.checkBalance.title': 'Get Account Balance',
    'docs.checkBalance.description': 'Check your current credit balance and available funds.',
    
    // Get Inbox
    'docs.inbox.title': 'Get incoming messages (2-Way SMS)',
    'docs.inbox.description': 'Retrieve incoming SMS messages sent to your assigned phone number. Requires phone number assignment by admin.',
    
    // Webhook
    'docs.webhook.title': 'Webhook Configuration (2-Way SMS)',
    'docs.webhook.description': 'Configure this webhook URL in your SMS provider account to receive incoming messages:',
    'docs.webhook.payloadInfo': 'The system will POST this payload when you receive SMS:',
    'docs.webhook.note': 'Note:',
    'docs.webhook.noteText': 'Contact admin to get a phone number assigned to your account. Incoming messages will be routed based on the receiver field.',
    
    'docs.request': 'Request',
    'docs.response': 'Response',
    'docs.example': 'Example',
    
    // Common
    'common.loading': 'Loading...',
    'common.error': 'Error',
    'common.success': 'Success',
    'common.cancel': 'Cancel',
    'common.save': 'Save',
    'common.delete': 'Delete',
    'common.edit': 'Edit',
  },
  zh: {
    // Landing Page
    'landing.title': 'Ibiki SMS',
    'landing.subtitle': '为您的业务需求提供安全、可扩展的短信网关',
    'landing.features.secure': '安全API访问',
    'landing.features.secureDesc': '企业级安全与加密API密钥',
    'landing.features.flexible': '灵活定价',
    'landing.features.flexibleDesc': '透明、按使用付费的定价模式',
    'landing.features.complete': '完整覆盖',
    'landing.features.completeDesc': '完整的短信API，包含发送追踪和报告',
    'landing.cta': '开始使用',
    'landing.login': '登录',
    
    // Navigation
    'nav.home': '首页',
    'nav.dashboard': '仪表板',
    'nav.docs': '文档',
    'nav.admin': '管理',
    'nav.login': '登录',
    'nav.signup': '注册',
    'nav.logout': '退出',
    
    // Auth
    'auth.signup.title': '创建您的账户',
    'auth.signup.subtitle': '开始通过我们的API发送短信',
    'auth.signup.name': '全名',
    'auth.signup.email': '电子邮箱',
    'auth.signup.company': '公司名称',
    'auth.signup.password': '密码',
    'auth.signup.confirmPassword': '确认密码',
    'auth.signup.submit': '创建账户',
    'auth.signup.hasAccount': '已有账户？',
    'auth.signup.loginLink': '登录',
    
    'auth.login.title': '欢迎回来',
    'auth.login.subtitle': '登录以访问您的账户',
    'auth.login.email': '电子邮箱',
    'auth.login.password': '密码',
    'auth.login.submit': '登录',
    'auth.login.noAccount': '没有账户？',
    'auth.login.signupLink': '注册',
    
    // Dashboard
    'dashboard.title': '仪表板',
    'dashboard.subtitle': '监控您的短信API使用情况和性能',
    'dashboard.stats.messages': '已发送总消息',
    'dashboard.stats.credits': '可用积分',
    'dashboard.stats.status': 'API状态',
    'dashboard.stats.online': '在线',
    'dashboard.stats.allTime': '全部时间',
    'dashboard.stats.balance': '当前余额',
    'dashboard.apiKey.title': '您的API凭据',
    'dashboard.apiKey.description': '使用此密钥验证所有API请求',
    'dashboard.buttons.viewDocs': '查看API文档',
    'dashboard.buttons.addCredits': '添加积分',
    'dashboard.addCredits.success': '积分添加成功',
    'dashboard.addCredits.successDesc': '您的积分余额已更新',
    'dashboard.addCredits.error': '添加积分失败',
    
    // Admin Dashboard
    'admin.title': '管理仪表板',
    'admin.subtitle': '管理客户和系统配置',
    'admin.stats.totalClients': '总客户数',
    'admin.stats.activeAccounts': '活跃账户',
    'admin.stats.totalMessages': '总消息数',
    'admin.stats.last30Days': '最近30天',
    'admin.stats.systemStatus': '系统状态',
    'admin.stats.healthy': '健康',
    'admin.stats.allRunning': '所有服务正常运行',
    
    'admin.tabs.clients': '客户',
    'admin.tabs.configuration': '配置',
    'admin.tabs.monitoring': '监控',
    
    'admin.clients.title': '客户管理',
    'admin.clients.subtitle': '查看和管理所有已连接的客户',
    'admin.clients.table.name': '客户名称',
    'admin.clients.table.email': '电子邮箱',
    'admin.clients.table.apiKey': 'API密钥',
    'admin.clients.table.status': '状态',
    'admin.clients.table.messages': '已发送消息',
    'admin.clients.table.lastActive': '最后活跃',
    'admin.clients.table.actions': '操作',
    'admin.clients.status.active': '活跃',
    'admin.clients.status.inactive': '不活跃',
    'admin.clients.actions.view': '查看',
    
    'admin.config.title': 'ExtremeSMS配置',
    'admin.config.subtitle': '配置您的ExtremeSMS集成和定价',
    'admin.config.apiKey.label': 'ExtremeSMS API密钥',
    'admin.config.apiKey.placeholder': '输入您的ExtremeSMS API密钥',
    'admin.config.pricing.title': '定价配置',
    'admin.config.pricing.extreme.label': 'ExtremeSMS成本',
    'admin.config.pricing.extreme.description': 'ExtremeSMS每条短信的成本',
    'admin.config.pricing.client.label': '客户费率',
    'admin.config.pricing.client.description': '向客户收取的费率',
    'admin.config.pricing.margin.label': '利润率',
    'admin.config.pricing.margin.perSms': '每条短信',
    'admin.config.buttons.save': '保存配置',
    'admin.config.buttons.test': '测试连接',
    
    // API Documentation
    'docs.title': 'API文档',
    'docs.subtitle': 'Ibiki SMS API v2.0 完整参考',
    'docs.authentication.title': '身份验证',
    'docs.authentication.strong': '身份验证:',
    'docs.authentication.description': '所有API请求都需要在Authorization标头中提供您的API密钥:',
    'docs.endpoints.title': '端点',
    
    // Send Single SMS
    'docs.sendSingle.title': '发送单条短信',
    'docs.sendSingle.description': '向单个收件人发送短信。立即返回消息ID。',
    
    // Send Bulk SMS
    'docs.sendBulk.title': '发送批量短信（相同消息）',
    'docs.sendBulk.description': '一次向多个收件人发送相同的短信消息。',
    
    // Send Bulk Multi
    'docs.sendBulkMulti.title': '发送批量短信（不同消息）',
    'docs.sendBulkMulti.description': '在单个请求中向多个收件人发送不同的短信消息。',
    
    // Check Delivery
    'docs.checkDelivery.title': '检查消息发送状态',
    'docs.checkDelivery.description': '使用消息ID获取先前发送的消息的发送状态。',
    
    // Check Balance
    'docs.checkBalance.title': '获取账户余额',
    'docs.checkBalance.description': '检查您当前的积分余额和可用资金。',
    
    // Get Inbox
    'docs.inbox.title': '获取接收的消息（双向短信）',
    'docs.inbox.description': '检索发送到您分配的电话号码的接收短信消息。需要管理员分配电话号码。',
    
    // Webhook
    'docs.webhook.title': 'Webhook配置（双向短信）',
    'docs.webhook.description': '在您的短信提供商账户中配置此webhook URL以接收来电消息:',
    'docs.webhook.payloadInfo': '当您收到短信时，系统将发送此有效载荷:',
    'docs.webhook.note': '注意:',
    'docs.webhook.noteText': '联系管理员为您的账户分配电话号码。来电消息将根据接收者字段路由。',
    
    'docs.request': '请求',
    'docs.response': '响应',
    'docs.example': '示例',
    
    // Common
    'common.loading': '加载中...',
    'common.error': '错误',
    'common.success': '成功',
    'common.cancel': '取消',
    'common.save': '保存',
    'common.delete': '删除',
    'common.edit': '编辑',
  }
};

export function translate(key: string, lang: Language): string {
  return (translations[lang] as Record<string, string>)[key] || key;
}
