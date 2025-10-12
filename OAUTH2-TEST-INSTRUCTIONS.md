# 🏁 iRacing OAuth2 Testing Instructions

## 🎯 **SAFE ISOLATED TESTING**

This test is completely separate from your RadianPlanner and won't affect racing this weekend!

## 📝 **STEP 1: Enter Your Credentials**

Edit `test-iracing-oauth2-isolated.js` and update this section:

```javascript
const OAUTH2_CONFIG = {
    clientId: 'YOUR_CLIENT_ID_HERE',          // ← Put your client_id here
    clientSecret: 'YOUR_CLIENT_SECRET_HERE',  // ← Put your client_secret here
    username: 'grannville@hotmail.co.uk',     // ← Already set
    password: 'YOUR_IRACING_PASSWORD_HERE'    // ← Put your iRacing password here
};
```

## 🧪 **STEP 2: Run The Test**

```bash
node test-iracing-oauth2-isolated.js
```

## 📊 **WHAT IT WILL TEST**

1. **OAuth2 Authentication** - Verify your credentials work
2. **Basic API Call** - Test `/constants/divisions` endpoint  
3. **Driver Lookup** - Get your profile data (Customer ID: 1175717)
4. **Additional Endpoint** - Test `/constants/event_types`

## ✅ **SUCCESS INDICATORS**

If working, you'll see:
```
🎉 OAuth2 Authentication SUCCESSFUL!
📊 Token Details:
   Access Token: abc123...
   Expires In: 600 seconds (10 minutes)
   
✅ API Call Successful!
   Status: 200
   Data size: 1234 characters
```

## ❌ **TROUBLESHOOTING**

### **"Please update OAUTH2_CONFIG"**
- You need to edit the credentials in the file

### **"Authentication failure"**  
- Check client_id and client_secret are correct
- Verify your iRacing password
- Make sure your email is pre-registered with iRacing

### **Rate Limited**
- Wait the specified seconds before trying again
- OAuth2 has strict rate limits

### **"unauthorized_client"**
- Your client_id might not be registered yet
- Contact iRacing if registration is still pending

## 🔒 **SECURITY**

- ✅ This file is in `.gitignore` - credentials won't be committed
- ✅ Completely isolated from main planner
- ✅ Safe to test during race weekend

## 🎯 **NEXT STEPS**

Once this test works:
1. You'll know your OAuth2 credentials are valid
2. We can integrate into main planner after your race weekend
3. Your automatic driver data collection will be ready!

---

**This test won't interfere with your racing activities!** 🏁