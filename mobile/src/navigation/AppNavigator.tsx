import { createNativeStackNavigator } from '@react-navigation/native-stack';
import DashboardScreen from '../screens/DashboardScreen';
import FinancialDashboardScreen from '../screens/FinancialDashboardScreen';
import LoginScreen from '../screens/LoginScreen';
import SubscriptionsScreen from '../screens/SubscriptionsScreen';

export type RootStackParamList = {
  Login:              undefined;
  FinancialDashboard: undefined;
  Dashboard:          undefined;
  Subscriptions:      undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  return (
    <Stack.Navigator initialRouteName="Login" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login"              component={LoginScreen} />
      <Stack.Screen name="FinancialDashboard" component={FinancialDashboardScreen} />
      <Stack.Screen name="Dashboard"          component={DashboardScreen} />
      <Stack.Screen name="Subscriptions"      component={SubscriptionsScreen} />
    </Stack.Navigator>
  );
}
