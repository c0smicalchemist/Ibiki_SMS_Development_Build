# How to Add More Languages to Ibiki SMS

Your app currently supports **English** and **Chinese (中文)**. Adding more languages is easy!

---

## 🌍 Quick Start: Add a New Language

### Example: Adding French

**Step 1: Update Language Type**
```typescript
// client/src/lib/i18n.ts (line 1)
export type Language = 'en' | 'zh' | 'fr';  // Add 'fr'
```

**Step 2: Add French Translations**
```typescript
// client/src/lib/i18n.ts (after line 308)
export const translations = {
  en: { /* existing */ },
  zh: { /* existing */ },
  fr: {
    // Landing Page
    'landing.title': 'Ibiki SMS',
    'landing.subtitle': 'Passerelle SMS sécurisée et évolutive pour vos besoins professionnels',
    'landing.features.secure': 'Accès API sécurisé',
    'landing.features.secureDesc': 'Sécurité de niveau entreprise avec clés API cryptées',
    
    // Navigation
    'nav.home': 'Accueil',
    'nav.dashboard': 'Tableau de bord',
    'nav.docs': 'Documentation',
    
    // API Documentation
    'docs.title': 'Documentation API',
    'docs.subtitle': 'Référence complète pour l\'API Ibiki SMS v2.0',
    'docs.authentication.strong': 'Authentification:',
    'docs.authentication.description': 'Toutes les requêtes API nécessitent votre clé API dans l\'en-tête Authorization:',
    
    'docs.sendSingle.title': 'Envoyer un SMS unique',
    'docs.sendSingle.description': 'Envoyer un SMS à un seul destinataire. Retourne immédiatement avec l\'ID du message.',
    
    // ... copy all keys from 'en' and translate
    
    'common.loading': 'Chargement...',
    'common.success': 'Succès',
    'common.error': 'Erreur',
  }
};
```

**Step 3: Update Language Toggle Component**
```typescript
// client/src/components/LanguageToggle.tsx
const languages = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'zh', label: '中文', flag: '🇨🇳' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },  // Add this
];
```

**Done!** Users can now switch to French 🇫🇷

---

## 🗣️ Popular Languages to Add

### **Spanish (Español)**
```typescript
export type Language = 'en' | 'zh' | 'es';

// Spanish translations
es: {
  'docs.title': 'Documentación API',
  'docs.subtitle': 'Referencia completa para la API de Ibiki SMS v2.0',
  'docs.sendSingle.title': 'Enviar SMS único',
  'docs.sendSingle.description': 'Enviar un SMS a un solo destinatario.',
  // ...
}
```

### **Arabic (العربية)**
```typescript
export type Language = 'en' | 'zh' | 'ar';

// Arabic translations (RTL support needed in CSS)
ar: {
  'docs.title': 'وثائق API',
  'docs.subtitle': 'مرجع كامل لـ Ibiki SMS API الإصدار 2.0',
  'docs.sendSingle.title': 'إرسال رسالة SMS واحدة',
  'docs.sendSingle.description': 'إرسال رسالة SMS إلى مستلم واحد.',
  // ...
}
```

### **Japanese (日本語)**
```typescript
export type Language = 'en' | 'zh' | 'ja';

ja: {
  'docs.title': 'APIドキュメント',
  'docs.subtitle': 'Ibiki SMS API v2.0の完全なリファレンス',
  'docs.sendSingle.title': 'SMS送信（単一）',
  'docs.sendSingle.description': '1人の受信者にSMSを送信します。',
  // ...
}
```

---

## 📝 Translation Checklist

To fully translate the app, you need to provide translations for these categories:

### 1. **Landing Page** (~10 keys)
- landing.title
- landing.subtitle
- landing.features.*
- landing.cta
- landing.login

### 2. **Navigation** (~6 keys)
- nav.home
- nav.dashboard
- nav.docs
- nav.admin
- nav.login
- nav.signup
- nav.logout

### 3. **Authentication** (~12 keys)
- auth.signup.*
- auth.login.*

### 4. **Dashboard** (~15 keys)
- dashboard.title
- dashboard.subtitle
- dashboard.stats.*
- dashboard.apiKey.*
- dashboard.buttons.*

### 5. **Admin Dashboard** (~20 keys)
- admin.title
- admin.subtitle
- admin.stats.*
- admin.tabs.*
- admin.clients.*
- admin.config.*

### 6. **API Documentation** (~20 keys)
- docs.title
- docs.subtitle
- docs.authentication.*
- docs.sendSingle.*
- docs.sendBulk.*
- docs.sendBulkMulti.*
- docs.checkDelivery.*
- docs.checkBalance.*
- docs.inbox.*
- docs.webhook.*

### 7. **Common** (~6 keys)
- common.loading
- common.error
- common.success
- common.cancel
- common.save
- common.delete
- common.edit

**Total:** ~90 translation keys

---

## 🤖 Using AI Translation Tools

### **ChatGPT / Claude Prompt:**
```
Please translate the following English i18n keys to [TARGET LANGUAGE]. 
Keep the key structure exactly the same, only translate the values.

Input format:
{
  'docs.title': 'API Documentation',
  'docs.subtitle': 'Complete reference for the Ibiki SMS API v2.0'
}

Output format: Same structure with translated values.

Here are the keys to translate:
[paste English translations here]
```

### **Google Translate (Bulk)**
1. Copy all English values into a spreadsheet
2. Use Google Translate add-on
3. Copy translated values back
4. Review for accuracy (especially technical terms)

---

## ✅ Testing Your Translation

1. **Add the language** to `i18n.ts`
2. **Update language toggle** to show new option
3. **Restart the app**: `npm run dev`
4. **Click language toggle** and select new language
5. **Check all pages:**
   - Landing page
   - Login/Signup
   - Dashboard
   - API Documentation
   - Admin Dashboard

---

## 🎯 Pro Tips

### **Keep Technical Terms Consistent**
- API → API (same in most languages)
- SMS → SMS (same in most languages)
- JSON → JSON (same in most languages)
- Bearer Token → May need localization

### **Use Professional Tone**
- This is B2B software
- Use formal language
- Avoid slang or casual terms

### **Test with Native Speakers**
- If possible, have a native speaker review
- Technical translations can be tricky
- Ensure clarity for your target audience

---

## 📦 No Deployment Needed!

Translation changes are **frontend-only**:
- Edit `client/src/lib/i18n.ts`
- Add language to type
- Add translations object
- Update LanguageToggle component
- Restart dev server

No database changes, no migrations, no backend changes needed!

---

## 🌍 Current Support

| Language | Code | Status | Flag |
|----------|------|--------|------|
| English | en | ✅ Complete | 🇬🇧 |
| Chinese | zh | ✅ Complete | 🇨🇳 |
| French | fr | 🔧 Easy to add | 🇫🇷 |
| Spanish | es | 🔧 Easy to add | 🇪🇸 |
| Arabic | ar | 🔧 Easy to add | 🇸🇦 |
| Japanese | ja | 🔧 Easy to add | 🇯🇵 |

---

**Questions?** Just ask - I can help translate to any language! 🚀
