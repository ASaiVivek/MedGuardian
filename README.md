# 🏥 MedGuardian Discord Bot

**Track Medicine Dosage with Configurable Meal Times**

MedGuardian is a Discord bot that helps families and groups track medicine schedules with flexible, configurable meal times. No external hosting required - all data stays in your Discord server!

## ✨ Features

- 🤖 **Discord Bot Integration** - Works entirely within Discord
- 📁 **File-Based Storage** - Data stored as JSON files in your Discord channels
- ⚙️ **Configurable Meal Times** - Set custom breakfast, lunch, dinner time ranges
- 👥 **Role-Based Access** - Tracker (admin) and Target (medicine taker) roles
- 💊 **Medicine Management** - Add, edit, delete medicines with dosage and frequency
- ⏰ **Smart Reminders** - Automatic notifications with interactive buttons
- 📦 **Inventory Tracking** - Low stock alerts and automatic inventory updates
- 📊 **Activity Logging** - Detailed logs and missed dose notifications
- 🔒 **Privacy First** - All data stays in your Discord server

## 🚀 Quick Start

### 1. Bot Setup
1. Invite MedGuardian bot to your Discord server
2. Run `/setup-medguardian` (Admin only)
3. Bot automatically creates required channels and files

### 2. Configure Meal Times
1. Use `/schedule-settings` to set your meal time ranges
2. Configure timezone and reminder advance time
3. Generate schedules for all medicines

### 3. Add Medicines
1. Use `/medicine-manager` to open the medicine management interface
2. Click "➕ Add Medicine" and fill the form
3. Specify target user, dosage, frequency, and inventory

### 4. Start Tracking
- Targets receive reminders in `#medicine-reminders`
- Click ✅ **Taken**, ❌ **Missed**, or ⏰ **Snooze 15min**
- Trackers get notified of missed doses in `#medicine-logs`

## 📋 Commands

### For Trackers (Admins)
- `/setup-medguardian` - Initialize bot for server
- `/medicine-manager` - Add/edit/delete medicines  
- `/schedule-settings` - Configure meal times & schedules
- `/delete-medicine <id>` - Delete specific medicine

### For Targets (Medicine Takers)
- `/my-medicines` - View your assigned medicines
- `/help` - Get help and documentation

## 🍽️ Medicine Frequency Options

- `before_breakfast` - Before breakfast meal
- `after_breakfast` - After breakfast meal  
- `before_lunch` - Before lunch meal
- `after_lunch` - After lunch meal
- `before_dinner` - Before dinner meal
- `after_dinner` - After dinner meal

## 🏗️ Architecture

```
Discord Server
├── #medicine-data (private) - JSON file storage
├── #medicine-reminders - Public notifications
└── #medicine-logs - Admin alerts & logs

Data Files (stored in #medicine-data):
├── medicines.json - Medicine definitions
├── targets.json - Target user info
├── schedules.json - Generated schedules
├── settings.json - Meal times & config
└── logs.json - Activity logs
```

## 🛠️ Installation & Development

### Prerequisites
- Node.js 16+ 
- Discord Bot Token
- Discord Server with Admin permissions

### Setup
1. Clone the repository
```bash
git clone <repository-url>
cd MedGuardian
```

2. Install dependencies
```bash
npm install
```

3. Configure environment
```bash
cp .env.example .env
# Edit .env with your Discord bot token and client ID
```

4. Start the bot
```bash
npm start
# or for development
npm run dev
```

### Environment Variables
```env
DISCORD_TOKEN=your_discord_bot_token_here
CLIENT_ID=your_discord_client_id_here
BOT_PREFIX=!
TIMEZONE=Asia/Kolkata
```

## 📊 Data Storage

All data is stored as JSON files in your Discord server's `#medicine-data` channel:

- **medicines.json** - Medicine definitions with dosage, frequency, targets
- **schedules.json** - Generated reminder schedules based on meal times
- **settings.json** - Configurable meal times and server settings
- **logs.json** - Activity logs and compliance tracking
- **targets.json** - Target user information and assignments

## 🔐 Privacy & Security

- ✅ **No external databases** - All data stays in your Discord server
- ✅ **File-based storage** - JSON files in private Discord channels
- ✅ **Role-based permissions** - Only admins can manage medicines
- ✅ **Local processing** - Bot processes data locally, no cloud storage
- ✅ **User control** - Server owners have complete control over their data

## 🎯 Use Cases

- **Family Medicine Tracking** - Parents track children's medications
- **Elderly Care** - Caregivers monitor senior medication schedules  
- **Chronic Condition Management** - Track multiple daily medications
- **Post-Surgery Recovery** - Temporary medication schedules
- **Vitamin & Supplement Tracking** - Daily health supplement reminders

## 🚀 Using MedGuardian Bot

### **Option 1: Use Our Hosted Bot (Recommended)**

**🤖 Get Invite Link**
- **Contact**: Reach out to [@ASaiVivek](https://github.com/ASaiVivek) for a bot invite link
- **Why Contact-Based**: Ensures proper onboarding and support for new users
- **Zero Setup**: No technical setup required - just invite and use!

### **Option 2: Self-Host Your Own Bot**

Follow the installation instructions above to run your own instance.

## 📚 Bot Usage Guide

### **Step 1: Initial Setup**

Once the bot joins your Discord server:

```
/setup-medguardian
```

This automatically creates:
- **#medicine-data** - Secure data storage channel
- **#medicine-reminders** - Daily reminder notifications  
- **#medicine-logs** - Activity and compliance logs
- **Tracker** and **Target** roles with proper permissions

### **Step 2: Configure Meal Times (Tracker Only)**

```
/schedule-settings
```

- Set custom breakfast, lunch, dinner time ranges
- Configure reminder advance times (e.g., 15 minutes before meals)
- Times are configurable per server and timezone

### **Step 3: Add Medicines (Tracker Only)**

```
/medicine-manager
```

**Add Medicine Form:**
- **Medicine Name**: e.g., "Vitamin D3"
- **Dosage**: e.g., "1 tablet", "5ml syrup"
- **Frequency**: Before/After Breakfast, Lunch, Dinner
- **Target**: Select family member from dropdown
- **Inventory**: Current stock count
- **Duration**: Treatment period

### **Step 4: Assign Targets**

1. **Invite family members** to your Discord server
2. **Assign Target role** to medicine takers
3. **Tracker role** for caregivers/parents (auto-assigned to admin)

### **Step 5: Daily Usage**

**For Targets (Medicine Takers):**
```
/my-medicines    # View assigned medicines and schedules
```

**Automatic Reminders:**
- Bot sends reminders at configured meal times
- Interactive buttons: **Taken** | **Missed** | **Snooze (15min)**
- Missed doses automatically notify Tracker after 30 minutes

**For Trackers (Caregivers):**
```
/medicine-manager     # Manage all medicines
/schedule-settings    # Configure meal times
/update-intake       # Manually update missed/late doses
/delete-medicine     # Remove medicines
```

### **Step 6: Missed Dose Management**

**Automatic Detection:**
- If no response within 30 minutes → Tracker gets notification
- Tracker receives verification buttons: **Taken** | **Actually Missed** | **Late**

**Manual Updates:**
```
/update-intake
```
- Select medicine, target, and status
- Add optional notes for compliance tracking
- All updates logged for audit trail

## 🔧 Advanced Features

### **Medicine Inventory Tracking**
- Automatic inventory countdown with each dose
- Low stock warnings (configurable threshold)
- Refill reminders for Trackers

### **Compliance & Reporting**
- Complete activity logs in #medicine-logs
- Missed dose patterns and statistics
- Export-ready compliance data

### **Multi-Family Support**
- Each Discord server = separate family/group
- Independent medicine schedules per server
- Role-based access control per server

### **Timezone Support**
- Configurable timezone per server
- Automatic daylight saving adjustments
- Meal times adapt to local schedules

## 📱 Mobile-Friendly

- **Discord Mobile App** - Full functionality on iOS/Android
- **Push Notifications** - Never miss a reminder
- **Offline Sync** - Catches up when back online
- **Voice Commands** - Use Discord's voice features

## 🛡️ Privacy & Compliance

- **HIPAA-Friendly** - No external data storage
- **Family-Controlled** - Data stays in your Discord server
- **Audit Trail** - Complete activity logging
- **Role-Based Access** - Only authorized family members
- **Data Portability** - Export JSON files anytime

## 🆘 Troubleshooting

### **Bot Not Responding**
```
/help    # Check bot status and permissions
```

### **Missing Permissions**
- Ensure bot has **Manage Channels**, **Send Messages**, **Attach Files**
- Check channel permissions for #medicine-data access

### **Reminders Not Working**
- Verify meal times in `/schedule-settings`
- Check Target role assignment
- Confirm timezone settings

### **Data Recovery**
- All data stored in #medicine-data channel as JSON files
- Download files for backup/migration
- Re-run `/setup-medguardian` to restore structure

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support & Contact

### **For Bot Invite Requests**
- **GitHub**: [@ASaiVivek](https://github.com/ASaiVivek)
- **Email**: Create an issue on GitHub with "Bot Invite Request" label
- **Response Time**: Usually within 24-48 hours

### **For Technical Support**
- Use `/help` command in Discord for bot-specific help
- Check the comprehensive documentation above
- Create an issue on GitHub for bugs or feature requests

### **Why Contact-Based Invites?**
- **Quality Assurance**: Ensure proper setup and onboarding
- **User Support**: Direct assistance during initial configuration
- **Feedback Collection**: Improve the bot based on real user experiences
- **Resource Management**: Manage bot hosting costs and server load

**Note**: Self-hosting is always available for technical users who prefer full control!

---

**MedGuardian** - Bringing smart medicine tracking to Discord communities! 💊⏰
