# WhoOwes

> AI-powered expense splitting for groups and friends — built with Expo + React Native.

---

## Features

- **Smart Expense Splitting** — equal, custom amounts, or percentage-based splits
- **AI Receipt Parsing** — photograph or PDF-upload a receipt; AI extracts line items and suggests splits
- **Friend & Group Management** — add friends, create groups, track shared bills
- **Balance Dashboard** — see who owes you and who you owe at a glance
- **Simplified Debt Engine** — minimizes the number of payments needed to clear all group debts
- **Settlements** — initiate, confirm, or reject payments between users
- **Real-time Pending Alerts** — 30-second polling for incoming settlement requests

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | [Expo SDK 54](https://expo.dev) (React Native 0.81.5, React 19) |
| Navigation | [@react-navigation/native-stack](https://reactnavigation.org) v7 + bottom-tabs |
| State (server) | [@tanstack/react-query](https://tanstack.com/query) v5 |
| State (client) | [Zustand](https://zustand-demo.pmnd.rs) v5 (auth + UI stores) |
| Styling | [NativeWind](https://www.nativewind.dev) v4 + Tailwind CSS v3 |
| Validation | [Zod](https://zod.dev) v4 |
| Icons | [@expo/vector-icons MaterialIcons](https://icons.expo.fyi) |
| Type Safety | TypeScript strict mode |

---

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- [Expo CLI](https://docs.expo.dev/get-started/installation/): `npm install -g expo-cli`
- [Expo Go](https://expo.dev/client) app on your iOS or Android device **or** a simulator

### Install & Run

```bash
# Clone the repository
git clone <repo-url>
cd whoowes

# Install dependencies
npm install

# Start the development server
npm start
# or: npx expo start
```

Scan the QR code with Expo Go (Android) or the Camera app (iOS) to open on your device.

### Platform-specific shortcuts

```bash
npm run android   # Open on Android emulator
npm run ios       # Open on iOS simulator (macOS only)
npm run web       # Open in browser (limited functionality)
```

---

## Demo Credentials

The app ships with a fully-featured mock data layer — no backend required.

| Field | Value |
|---|---|
| Email | `alex@example.com` |
| Password | `password123` |

Additional demo users (for friends/groups): `jamie@example.com`, `sam@example.com`, `morgan@example.com`

---

## Project Structure

```
whoowes/
├── App.tsx                    # Root: QueryClient, Navigation, Toast, Modal
├── src/
│   ├── types/
│   │   ├── index.ts           # All domain types (User, Expense, Settlement…)
│   │   └── navigation.ts      # Typed navigation param lists
│   ├── store/
│   │   ├── authStore.ts       # Auth state (user, token) — persisted
│   │   └── uiStore.ts         # Toasts, modals, dark mode
│   ├── services/              # API service layer (swap for real backend)
│   │   ├── AuthService.ts
│   │   ├── ExpenseService.ts
│   │   ├── FriendsService.ts
│   │   ├── GroupsService.ts
│   │   ├── ReceiptService.ts
│   │   └── SettlementService.ts
│   ├── hooks/                 # TanStack Query hooks per domain
│   │   ├── useAuth.ts
│   │   ├── useExpenses.ts
│   │   ├── useFriends.ts
│   │   ├── useGroups.ts
│   │   ├── useReceipts.ts
│   │   └── useSettlements.ts
│   ├── navigation/            # RootNavigator + all stack/tab navigators
│   ├── screens/
│   │   ├── auth/              # LoginScreen, RegisterScreen
│   │   ├── dashboard/         # DashboardScreen
│   │   ├── friends/           # FriendsListScreen, AddFriendScreen, FriendDetailScreen
│   │   ├── groups/            # GroupsListScreen, CreateGroupScreen, GroupDetailScreen, GroupBalancesScreen
│   │   ├── expenses/          # AddExpenseScreen, ManualExpenseScreen, ExpenseDetailScreen
│   │   ├── receipts/          # ReceiptUploadScreen, ReceiptReviewScreen
│   │   ├── settlements/       # SettlementsScreen, InitiateSettlementScreen, PendingSettlementsScreen, SettlementDetailScreen
│   │   └── profile/           # ProfileScreen
│   ├── components/
│   │   ├── ui/                # Button, Screen, Card, Toast, ConfirmModal, Badge…
│   │   └── forms/             # FormInput, FormSelect…
│   ├── utils/
│   │   └── splitEngine.ts     # calculateSplit() — equal / custom / percentage
│   ├── theme/                 # Colors, Typography, Spacing, Shadows
│   └── constants/             # API base URL, query keys, category definitions
```

---

## Connecting a Real Backend

The `src/services/` layer is the only place that needs to change. Each service currently returns mock data.

1. Update `src/constants/index.ts` → set `API_BASE_URL` to your server URL
2. Replace mock responses in each `*Service.ts` with real `axios` calls
3. Ensure your API responses match the types in `src/types/index.ts`

Example (`ExpenseService.ts`):
```typescript
// Before (mock)
async getExpenses(userId: string): Promise<Expense[]> {
  return MOCK_EXPENSES.filter(e => e.paidBy === userId);
}

// After (real)
async getExpenses(userId: string): Promise<Expense[]> {
  const res = await axios.get<ApiResponse<Expense[]>>(`${API_BASE_URL}/expenses?userId=${userId}`);
  return res.data.data;
}
```

---

## Building for Production

This project uses [EAS Build](https://docs.expo.dev/build/introduction/).

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Configure (first time only)
eas build:configure

# Build for Android
eas build --platform android

# Build for iOS
eas build --platform ios

# Build for both
eas build --platform all
```

---

## Scripts

| Command | Description |
|---|---|
| `npm start` | Start Expo dev server |
| `npm run android` | Launch on Android emulator |
| `npm run ios` | Launch on iOS simulator |
| `npm run web` | Launch in browser |

---

## License

MIT
