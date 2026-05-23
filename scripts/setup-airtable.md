# Airtable Base Setup Guide

## Step 1 — Create the Base

1. Go to airtable.com → **Add a base** → **Start from scratch**
2. Name it: **AcaciaVelds DAR**

---

## Step 2 — Create Each Table

### Table 1: Staff

| Field Name      | Field Type      | Notes                                    |
|-----------------|-----------------|------------------------------------------|
| Name            | Single line text| Primary field                            |
| Role            | Single select   | Options: Supervisor / Herdsman / Farm Manager |
| Employee ID     | Single line text|                                          |
| Phone           | Phone number    |                                          |
| Username        | Single line text|                                          |
| Password Hash   | Single line text| Stores the hashed password               |
| Active          | Checkbox        | Default: checked                         |

**Seed records** (at minimum):
- Farm Manager: Name=Farm Manager, Role=Farm Manager, Username=manager, Password Hash=(hash of your chosen password), Active=✓
- Supervisor: Name=Supervisor One, Role=Supervisor, Username=supervisor1, Password Hash=..., Active=✓
- Herdsman: Name=Herdsman One, Role=Herdsman, Username=herdsman1, Password Hash=..., Active=✓

> To generate a password hash, open browser console and run:
> ```js
> function hashPassword(p) {
>   let h = 0;
>   for (let i = 0; i < p.length; i++) h = (Math.imul(31, h) + p.charCodeAt(i)) | 0;
>   return h.toString(16);
> }
> hashPassword('yourpassword')
> ```

---

### Table 2: Groups

| Field Name           | Field Type      | Notes                               |
|----------------------|-----------------|-------------------------------------|
| Group Name           | Single line text| Primary field                       |
| Type                 | Single select   | Options: Grazing / Enclosure        |
| Current Total Count  | Number          |                                     |
| Primary Herdsman     | Link to Staff   | Allow linking to Staff table        |

**Seed 7 records:**

| Group Name            | Type      |
|-----------------------|-----------|
| Annex Farm            | Grazing   |
| Main Farm             | Grazing   |
| Horsefield            | Grazing   |
| Paddock – Mothers     | Grazing   |
| Paddock – Kids        | Grazing   |
| Paddock – Males       | Grazing   |
| Sick/Vulnerable Flock | Enclosure |

---

### Table 3: Daily Sessions

| Field Name                | Field Type      | Notes                                      |
|---------------------------|-----------------|--------------------------------------------|
| Session ID                | Single line text| Primary field; e.g. DAR-20260523-ANN       |
| Date                      | Date            |                                            |
| Group                     | Link to Groups  |                                            |
| Herdsman                  | Link to Staff   |                                            |
| Grazing Ground            | Single line text|                                            |
| AM Departure Time         | Single line text| Store as HH:MM string                      |
| AM Count                  | Number          |                                            |
| PM Return Time            | Single line text|                                            |
| PM Count                  | Number          |                                            |
| Variance                  | Formula         | `{PM Count} - {AM Count}`                  |
| Status                    | Single select   | Open / Complete / Discrepancy / Alert      |
| Counting Supervisor       | Link to Staff   |                                            |
| Herdsman In Charge        | Link to Staff   |                                            |
| Witness                   | Link to Staff   |                                            |
| Weather                   | Single line text|                                            |
| Supervisor Signature      | Checkbox        |                                            |
| Herdsman Signature        | Checkbox        |                                            |
| Witness Signature         | Checkbox        |                                            |
| Date/Time Signed          | Single line text|                                            |
| Farm Manager Reviewed     | Single select   | Approved / Query / Discrepancy Noted       |
| Notes                     | Long text       |                                            |

---

### Table 4: Animal Movements

| Field Name                      | Field Type      | Notes                                          |
|---------------------------------|-----------------|------------------------------------------------|
| Movement ID                     | Auto number     | Primary field                                  |
| Session                         | Link to Daily Sessions |                                         |
| Ear Tag                         | Single line text|                                                |
| From Group                      | Link to Groups  |                                                |
| To Group                        | Link to Groups  |                                                |
| Time                            | Single line text|                                                |
| Reason                          | Single select   | Transfer / Death / Sale / Birth / Vet Referral / Other |
| Health/Condition Notes          | Long text       |                                                |
| Vet Referral Flag               | Checkbox        |                                                |
| Authorised By                   | Link to Staff   |                                                |
| Destination Herdsman Confirmed  | Checkbox        |                                                |
| Count Impact                    | Single select   | Out (−1) / In (+1) / No Change                 |

---

### Table 5: Animal Registry

| Field Name          | Field Type      | Notes                                       |
|---------------------|-----------------|---------------------------------------------|
| Ear Tag             | Single line text| Primary field; unique                       |
| Group               | Link to Groups  |                                             |
| Status              | Single select   | Active / Sold / Deceased / Born (pending tag) |
| Date Added          | Date            |                                             |
| Date of Status Change | Date          |                                             |
| Notes               | Long text       |                                             |

---

### Table 6: Field Updates

| Field Name                   | Field Type      | Notes                         |
|------------------------------|-----------------|-------------------------------|
| Update ID                    | Auto number     | Primary field                 |
| Session                      | Link to Daily Sessions |                        |
| Submitted By                 | Link to Staff   |                               |
| Timestamp                    | Date            | Include time                  |
| Current Count in Field       | Number          |                               |
| Issues Reported              | Long text       |                               |
| Alert Level                  | Single select   | None / Advisory / Urgent      |
| Acknowledged By Supervisor   | Checkbox        |                               |

---

### Table 7: Grazing Grounds

| Field Name | Field Type      | Notes               |
|------------|-----------------|---------------------|
| Name       | Single line text| Primary field       |
| Last Used  | Date            |                     |

---

## Step 3 — Get Your API Credentials

1. Go to **airtable.com/create/tokens** → Create a new Personal Access Token
2. Scopes needed: `data.records:read`, `data.records:write`, `schema.bases:read`
3. Grant access to your **AcaciaVelds DAR** base
4. Copy the token → paste into `.env` as `VITE_AIRTABLE_API_KEY`

5. Open your base URL: `https://airtable.com/appXXXXXXXX/...`
   The `appXXXXXXXX` part is your `VITE_AIRTABLE_BASE_ID`

---

## Step 4 — Start the App

```bash
cd dar-app
npm run dev
```

Then open http://localhost:5173 and log in with the credentials you seeded.
