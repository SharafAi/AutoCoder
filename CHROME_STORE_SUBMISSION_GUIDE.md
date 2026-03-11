# Chrome Web Store Submission Guide for AutoCoder

## 📋 Complete Checklist

### 1. **Account Tab**

- [ ] Add contact email
- [ ] Verify contact email (check your inbox for verification link)

---

### 2. **Store Listing Tab**

#### Product Details

**Language:** English (United States)

**Category:** Productivity

**Store Icon (128x128):**

- Upload: `store_icon.png`

**Screenshots (1280x800):**

- Upload: `screenshot1_1280x800.png`
- Upload: `screenshot2_1280x800.png`
- Upload: `screenshot3_1280x800.png`

**Promotional Images:**

- Small tile (440x280): Upload `promo_440x280.png`

**Detailed Description (minimum 25 characters):**

```
AutoCoder - Professional Container Automation Tool

Transform your container management workflow with AutoCoder, a powerful Chrome extension designed to automate repetitive data entry tasks and streamline your operations.

🚀 Key Features:

✅ Smart Automation - Automate container code entry with intelligent element detection and calibration
✅ Customizable Workflows - Configure input fields, search buttons, and confirmation actions to match your specific needs
✅ Batch Processing - Process multiple containers efficiently with automated verification
✅ Visual Progress Tracking - Real-time status updates and progress indicators for each container
✅ Persistent Configuration - Save and share your calibration settings via config.json for team-wide consistency
✅ Element Calibration - Advanced element selector with visual feedback for precise targeting
✅ Professional UI - Clean, modern dark-themed interface with intuitive controls

💼 Perfect For:

- Logistics professionals managing container tracking codes
- Teams handling high-volume data entry tasks
- Operations requiring consistent, error-free code management
- Anyone looking to eliminate repetitive manual input

🎯 How It Works:

1. Calibrate - Use the visual element selector to identify input fields and buttons on your target website
2. Configure - Set up your container list and code values
3. Automate - Let AutoCoder handle the repetitive work while you focus on what matters
4. Verify - Track success/failure status for each container with built-in verification

⚡ Built for Speed & Reliability:

AutoCoder is designed to save you hours of manual work. What used to take hours of tedious data entry now happens automatically with precision and reliability.

🛡️ Privacy & Monetization:

- **Advertisements**: AutoCoder is supported by non-intrusive advertisements (A-Ads) displayed within the extension panel. This monetization model allows for **cryptocurrency payouts** while serving general advertisements. No user data is shared with advertisers.
- All data processing happens locally in your browser
- No external servers or data collection
- Your configurations stay private and secure
- No user data is transmitted or stored externally

💡 Pro Tips:

- Use the "Connect Config File" feature to share settings across your team
- Enable verification tracking to ensure 100% accuracy
- Customize the code input for different container types

Transform your container management today with AutoCoder!
```

---

### 3. **Privacy Practices Tab**

#### Single Purpose Description

```
AutoCoder automates container code entry and data management tasks by allowing users to configure and execute repetitive form-filling operations on web pages. The extension also displays non-intrusive advertisements within its interface to support its ongoing development and maintenance.
```

#### Permission Justifications

**activeTab:**

```
Required to interact with the currently active web page where the user wants to automate container code entry. This permission allows AutoCoder to inject the automation interface and interact with form elements on the page the user is currently viewing.
```

**clipboardWrite:**

```
Required to copy container numbers and tracking codes to the user's clipboard for quick pasting and verification. This enables users to easily transfer data between the extension and other applications without manual typing.
```

**scripting:**

```
Required to inject the AutoCoder interface and automation scripts into web pages. This permission enables the extension to add the automation panel, detect form elements, and execute the configured automation sequences on the user's target websites.
```

**Remote Code:**

```
This extension does not use remote code. All code is packaged within the extension and executed locally. The extension loads a local config.json file for user settings, but does not execute any remotely hosted code.
```

#### Data Usage Certification

- [x] **Check:** "This item does not collect or use user data"
- **Explanation:** AutoCoder processes all data locally within the browser. No user data, container numbers, or tracking codes are transmitted to external servers or stored outside the user's local browser storage.

#### Host Permissions

```
The extension uses <all_urls> match pattern to access the config.json file as a web-accessible resource. This is necessary for the extension to load user configuration settings. The extension does not transmit any data to external servers.
```

---

### 4. **Distribution Tab**

**Visibility:** Public

**Regions:** All regions (or select specific countries)

**Pricing:** Free

---

## 📝 Quick Copy-Paste Answers

### For "Why does your extension need this permission?"

**activeTab:**

```
Interact with the active web page to automate form filling and container code entry
```

**clipboardWrite:**

```
Copy container numbers and codes to clipboard for user convenience
```

**scripting:**

```
Inject automation interface and scripts into web pages for form automation
```

**storage:**

```
Required to save and persist user calibration settings and preferences locally within the extension.
```

**Remote code justification:**

```
No remote code is used. All scripts are packaged locally within the extension.
```

---

## ✅ Step-by-Step Submission Process

### Step 1: Account Setup

1. Go to **Account** tab
2. Enter your contact email
3. Click verification link in email
4. Wait for verification confirmation

### Step 2: Upload Extension

1. Zip your extension folder (include: manifest.json, inject.js, background.js, config.json, icon16.png, icon48.png, icon128.png)
2. Upload the ZIP file
3. Wait for processing

### Step 3: Store Listing

1. Select **Language:** English (United States)
2. Select **Category:** Productivity
3. Upload **Icon:** store_icon.png
4. Upload **Screenshots:** screenshot1_1280x800.png, screenshot2_1280x800.png, screenshot3_1280x800.png
5. Upload **Promotional tile:** promo_440x280.png
6. Paste the **Detailed Description** (from above)

### Step 4: Privacy Practices

1. Paste **Single Purpose Description**
2. Add **Permission Justifications** for each permission
3. Select: "This item does not collect or use user data"
4. Check the certification box
5. Save changes

### Step 5: Distribution

1. Select **Visibility:** Public
2. Select **Regions:** All regions
3. Select **Pricing:** Free
4. Save changes

### Step 6: Submit for Review

1. Review all tabs for completeness
2. Click **Submit for Review**
3. Wait for Google's review (typically 1-3 business days)

---

## 🎯 Important Notes

- **Review Time:** Usually 1-3 business days
- **Email Verification:** Must be completed before submission
- **Screenshots:** At least 1 required, you have 3 ready
- **Icon:** Must be exactly 128x128 pixels (you have store_icon.png)
- **Privacy:** Be honest about data usage (you don't collect any data)

---

## 📧 Support

If you encounter issues during submission:

- Check Chrome Web Store Developer Program Policies
- Ensure all required fields are filled
- Verify email is confirmed
- All images meet size requirements

Good luck with your submission! 🚀
