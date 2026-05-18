import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import {
  AppState,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  addNotificationListener,
  getPendingNotifications,
  isNotificationServiceEnabled,
  NotificationEvent,
  openNotificationSettings,
} from 'notification-listener';
import { RootStackParamList } from '../navigation/AppNavigator';

const API_URL = 'http://192.168.86.241:8080';

const T = {
  blue:      '#4A6FA5',
  bg:        '#F5F7FA',
  card:      '#FFFFFF',
  text:      '#1A1D23',
  textMid:   '#5A6070',
  textLight: '#9AA0AD',
  border:    '#E8EAF0',
  green:     '#2E8B6A',
  red:       '#D94F4F',
};

const CATEGORY_COLOR: Record<string, string> = {
  'Alimentación':    '#F97316',
  'Transporte':      '#3B82F6',
  'Entretenimiento': '#8B5CF6',
  'Suscripciones':   '#EC4899',
  'Salud':           '#10B981',
  'Ingreso':         '#2E8B6A',
  'Otros':           '#9AA0AD',
};

const CATEGORY_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  'Alimentación':    'restaurant-outline',
  'Transporte':      'car-outline',
  'Entretenimiento': 'film-outline',
  'Suscripciones':   'repeat-outline',
  'Salud':           'medkit-outline',
  'Ingreso':         'arrow-down-circle-outline',
  'Otros':           'grid-outline',
};

function categoryColor(name: string): string {
  return CATEGORY_COLOR[name] ?? T.blue;
}
function categoryIcon(name: string): keyof typeof Ionicons.glyphMap {
  return CATEGORY_ICON[name] ?? 'ellipse-outline';
}
function formatCOP(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(amount);
}
function formatFecha(iso: string): string {
  const date = new Date(iso);
  const diff = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (diff === 0) return 'Hoy';
  if (diff === 1) return 'Ayer';
  if (diff < 7)  return `Hace ${diff} días`;
  return date.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
}

type TransactionItem = {
  id: string; comercio: string; categoria: string;
  tipo: string; monto: number; divisa: string; fecha: string;
};

function getBankIcon(pkg: string): { name: keyof typeof Ionicons.glyphMap; color: string } {
  if (pkg.includes('bancolombia'))                            return { name: 'business-outline',   color: '#FFB800' };
  if (pkg.includes('nequi'))                                  return { name: 'wallet-outline',     color: '#6C1D8E' };
  if (pkg.includes('nu.product'))                             return { name: 'card-outline',       color: '#820AD1' };
  if (pkg.includes('davivienda') || pkg.includes('daviplata'))return { name: 'card-outline',       color: '#D40000' };
  if (pkg.includes('bbva'))                                   return { name: 'card-outline',       color: '#004C9E' };
  if (pkg.includes('bold') || pkg.includes('rappi'))          return { name: 'storefront-outline', color: '#FF6B00' };
  return { name: 'card-outline', color: T.blue };
}

type Props = NativeStackScreenProps<RootStackParamList, 'Dashboard'>;

const NAV_TABS: { label: string; icon: keyof typeof Ionicons.glyphMap; active: boolean }[] = [
  { label: 'Inicio',          icon: 'home-outline',   active: false },
  { label: 'Suscripciones',   icon: 'repeat-outline', active: false },
  { label: 'Notificaciones',  icon: 'notifications',  active: true  },
  { label: 'Perfil',          icon: 'person-outline', active: false },
];

export default function DashboardScreen({ navigation }: Props) {
  const [hasPermission,  setHasPermission]  = useState<boolean | null>(null);
  const [notifications,  setNotifications]  = useState<NotificationEvent[]>([]);
  const [dbTransactions, setDbTransactions] = useState<TransactionItem[]>([]);

  const checkPermission = useCallback(() => {
    if (Platform.OS === 'android') setHasPermission(isNotificationServiceEnabled());
    else setHasPermission(false);
  }, []);

  useEffect(() => {
    checkPermission();
    const sub = AppState.addEventListener('change', s => { if (s === 'active') checkPermission(); });
    return () => sub.remove();
  }, [checkPermission]);

  const sendNotificationToApi = useCallback(async (event: NotificationEvent) => {
    const token = await AsyncStorage.getItem('token');
    if (!token) return;
    try {
      await fetch(`${API_URL}/notifications/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: event.title ?? '',
          text: event.text ?? '',
          package_name: event.packageName ?? '',
          timestamp: event.timestamp ?? Date.now(),
        }),
      });
      fetchTransactions();
    } catch {}
  }, [fetchTransactions]);

  // Load from persistent store on every mount — intentionally NOT clearing so
  // notifications survive tab switches. The service always writes to the store,
  // so reloading on remount gives the full history.
  useEffect(() => {
    if (!hasPermission) return;
    const stored = getPendingNotifications();
    if (stored.length > 0) setNotifications(stored.slice(0, 50));

    const sub = addNotificationListener((event) => {
      setNotifications(prev => [event, ...prev].slice(0, 50));
      sendNotificationToApi(event);
    });
    return () => sub.remove();
  }, [hasPermission, sendNotificationToApi]);

  const fetchTransactions = useCallback(async () => {
    const token = await AsyncStorage.getItem('token');
    if (!token) return;
    try {
      const now = new Date();
      const res = await fetch(
        `${API_URL}/summary?month=${now.getMonth() + 1}&year=${now.getFullYear()}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (res.ok) {
        const body = await res.json();
        setDbTransactions(body.transacciones ?? []);
      }
    } catch {}
  }, []);

  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

  function handleTabPress(label: string) {
    if (label === 'Inicio') navigation.replace('FinancialDashboard');
  }

  return (
    <SafeAreaView style={s.safeArea}>
      <View style={s.container}>

        {/* Header */}
        <View style={s.header}>
          <View style={s.headerTop}>
            <View>
              <Text style={s.greeting}>Actividad</Text>
              <Text style={s.title}>Notificaciones</Text>
            </View>
            <View style={s.bellWrap}>
              <Ionicons name="notifications-outline" size={20} color="#fff" />
              {hasPermission && notifications.length > 0 && <View style={s.bellDot} />}
            </View>
          </View>

          <View style={s.statsRow}>
            <View style={s.statChip}>
              <Text style={s.statValue}>{dbTransactions.length}</Text>
              <Text style={s.statLabel}>Procesadas</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.statChip}>
              <Text style={s.statValue}>{notifications.length}</Text>
              <Text style={s.statLabel}>Capturadas</Text>
            </View>
          </View>
        </View>

        {/* Body */}
        <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>

          {/* — Movimientos procesados — */}
          <Text style={s.sectionTitle}>MOVIMIENTOS PROCESADOS</Text>
          {dbTransactions.length === 0 ? (
            <View style={s.emptyCard}>
              <Ionicons name="receipt-outline" size={32} color={T.textLight} />
              <Text style={s.emptyText}>Sin movimientos procesados este mes</Text>
            </View>
          ) : (
            <View style={s.list}>
              {dbTransactions.map((tx, i) => {
                const isIngreso = tx.tipo === 'ingreso';
                const color = categoryColor(tx.categoria);
                return (
                  <View key={tx.id} style={[s.row, i > 0 && s.rowBorder]}>
                    <View style={[s.iconWrap, { backgroundColor: color + '18' }]}>
                      <Ionicons name={categoryIcon(tx.categoria)} size={18} color={color} />
                    </View>
                    <View style={s.info}>
                      <Text style={s.rowTitle} numberOfLines={1}>{tx.comercio}</Text>
                      <Text style={s.rowMeta}>{tx.categoria} · {formatFecha(tx.fecha)}</Text>
                    </View>
                    <Text style={[s.amount, { color: isIngreso ? T.green : T.red }]}>
                      {isIngreso ? '+' : '-'}{formatCOP(tx.monto)}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}

          {/* — Notificaciones capturadas — */}
          <Text style={[s.sectionTitle, s.sectionGap]}>NOTIFICACIONES CAPTURADAS</Text>
          {hasPermission === null ? (
            <View style={s.emptyCard}>
              <Text style={s.emptyText}>Verificando permisos…</Text>
            </View>
          ) : !hasPermission ? (
            <View style={s.permCard}>
              <Ionicons name="notifications-circle-outline" size={44} color={T.blue} style={{ marginBottom: 12 }} />
              <Text style={s.permTitle}>Permiso requerido</Text>
              <Text style={s.permBody}>
                FinWard necesita acceso a las notificaciones para detectar movimientos bancarios.
              </Text>
              <TouchableOpacity style={s.permBtn} onPress={openNotificationSettings} activeOpacity={0.85}>
                <Text style={s.permBtnText}>Conceder acceso</Text>
              </TouchableOpacity>
            </View>
          ) : notifications.length === 0 ? (
            <View style={s.emptyCard}>
              <Ionicons name="mail-outline" size={32} color={T.textLight} />
              <Text style={s.emptyText}>
                Esperando notificaciones bancarias…{'\n'}Realiza una transacción para verla aquí.
              </Text>
            </View>
          ) : (
            <View style={s.list}>
              {notifications.map((item, i) => {
                const { name: icon, color } = getBankIcon(item.packageName ?? '');
                return (
                  <View key={`${item.timestamp}-${i}`} style={[s.row, i > 0 && s.rowBorder]}>
                    <View style={[s.iconWrap, { backgroundColor: color + '18' }]}>
                      <Ionicons name={icon} size={18} color={color} />
                    </View>
                    <View style={s.info}>
                      <Text style={s.rowTitle} numberOfLines={1}>{item.title || 'Sin título'}</Text>
                      <Text style={s.rowMeta} numberOfLines={1}>{item.packageName}</Text>
                    </View>
                    <View style={s.notifRight}>
                      <Text style={s.notifText} numberOfLines={2}>{item.text || '—'}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>

        {/* Bottom nav */}
        <View style={s.bottomNav}>
          {NAV_TABS.map(tab => (
            <TouchableOpacity key={tab.label} style={s.navTab} onPress={() => handleTabPress(tab.label)} activeOpacity={0.7}>
              <Ionicons name={tab.icon} size={22} color={tab.active ? T.blue : T.textLight} />
              <Text style={[s.navLabel, tab.active && s.navLabelActive]}>{tab.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safeArea:  { flex: 1, backgroundColor: T.blue },
  container: { flex: 1, backgroundColor: T.bg },

  header: {
    backgroundColor: T.blue,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  greeting: { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginBottom: 2 },
  title:    { fontSize: 20, fontWeight: '700', color: '#fff' },
  bellWrap: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  bellDot: {
    position: 'absolute', top: 6, right: 6,
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: '#FF6B6B', borderWidth: 2, borderColor: T.blue,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    overflow: 'hidden',
  },
  statChip:    { flex: 1, alignItems: 'center', paddingVertical: 12 },
  statDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.18)', marginVertical: 8 },
  statValue:   { fontSize: 22, fontWeight: '700', color: '#fff', letterSpacing: -0.5 },
  statLabel:   { fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 2 },

  scroll:        { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 12 },

  sectionTitle: {
    fontSize: 11, fontWeight: '700', color: T.textLight,
    letterSpacing: 0.5, marginBottom: 10,
  },
  sectionGap: { marginTop: 20 },

  list: {
    backgroundColor: T.card, borderRadius: 16, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  row:       { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14, gap: 12 },
  rowBorder: { borderTopWidth: 1, borderTopColor: T.border },
  iconWrap:  { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  info:      { flex: 1, minWidth: 0 },
  rowTitle:  { fontSize: 14, fontWeight: '600', color: T.text },
  rowMeta:   { fontSize: 11, color: T.textLight, marginTop: 2 },
  amount:    { fontSize: 14, fontWeight: '700' },
  notifRight:{ maxWidth: 110, alignItems: 'flex-end' },
  notifText: { fontSize: 12, color: T.textMid, textAlign: 'right' },

  emptyCard: {
    backgroundColor: T.card, borderRadius: 16, padding: 28,
    alignItems: 'center', gap: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  emptyText: { fontSize: 13, color: T.textMid, textAlign: 'center', lineHeight: 20 },

  permCard: {
    backgroundColor: T.card, borderRadius: 16, padding: 24, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 16, elevation: 4,
  },
  permTitle: { fontSize: 17, fontWeight: '700', color: T.text, marginBottom: 8, textAlign: 'center' },
  permBody:  { fontSize: 13, color: T.textMid, textAlign: 'center', lineHeight: 19, marginBottom: 20 },
  permBtn:   { backgroundColor: T.blue, paddingVertical: 12, paddingHorizontal: 28, borderRadius: 12 },
  permBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },

  bottomNav: {
    height: 60, backgroundColor: T.card,
    borderTopWidth: 1, borderTopColor: T.border,
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-around', paddingHorizontal: 8,
  },
  navTab:         { alignItems: 'center', gap: 3, paddingHorizontal: 12, paddingVertical: 4 },
  navLabel:       { fontSize: 10, color: T.textLight },
  navLabelActive: { color: T.blue, fontWeight: '600' },
});
