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

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

- Use `/help` command in Discord
- Check the documentation above
- Create an issue on GitHub
- Join our support Discord server

---

**MedGuardian** - Bringing smart medicine tracking to Discord communities! 💊⏰
