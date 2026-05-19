import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  addNotificationListener,
  clearPendingNotifications,
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
  tipo: string; monto: number; divisa: string; fecha: string; banco: string;
};

type BankMeta = { name: keyof typeof Ionicons.glyphMap; color: string; label: string };
function getBankMeta(pkg: string): BankMeta {
  if (pkg.includes('bancolombia'))                             return { name: 'business-outline',   color: '#FFB800', label: 'Bancolombia' };
  if (pkg.includes('nequi'))                                   return { name: 'wallet-outline',     color: '#6C1D8E', label: 'Nequi' };
  if (pkg.includes('nu.production') || pkg.includes('nu.product')) return { name: 'card-outline',  color: '#820AD1', label: 'Nu' };
  if (pkg.includes('daviplata'))                               return { name: 'card-outline',       color: '#D40000', label: 'Daviplata' };
  if (pkg.includes('davivienda'))                              return { name: 'card-outline',       color: '#D40000', label: 'Davivienda' };
  if (pkg.includes('bbva'))                                    return { name: 'card-outline',       color: '#004C9E', label: 'BBVA' };
  if (pkg.includes('rappi.bank'))                              return { name: 'card-outline',       color: '#FF6B00', label: 'RappiBank' };
  if (pkg.includes('rappi'))                                   return { name: 'storefront-outline', color: '#FF6B00', label: 'Rappi' };
  if (pkg.includes('bold'))                                    return { name: 'storefront-outline', color: '#FF6B00', label: 'Bold' };
  if (pkg.includes('lulobank'))                                return { name: 'card-outline',       color: '#00C896', label: 'Lulo Bank' };
  if (pkg.includes('scotiabank') || pkg.includes('colpatria')) return { name: 'card-outline',       color: '#EC0000', label: 'Scotiabank' };
  if (pkg.includes('bogota'))                                  return { name: 'card-outline',       color: '#005CA9', label: 'Banco de Bogotá' };
  if (pkg.includes('avvillas'))                                return { name: 'card-outline',       color: '#F7941D', label: 'AV Villas' };
  return { name: 'card-outline', color: T.blue, label: 'Banco' };
}

// Keep for backwards compat with existing callers
function getBankIcon(pkg: string): { name: keyof typeof Ionicons.glyphMap; color: string } {
  const { name, color } = getBankMeta(pkg);
  return { name, color };
}

// Maps a human-readable bank name (from DB) to its brand colour
function getBankColor(bankName: string): string {
  const n = bankName.toLowerCase();
  if (n.includes('bancolombia'))                return '#FFB800';
  if (n.includes('nequi'))                      return '#6C1D8E';
  if (n.includes('nu'))                         return '#820AD1';
  if (n.includes('daviplata'))                  return '#D40000';
  if (n.includes('davivienda'))                 return '#D40000';
  if (n.includes('bbva'))                       return '#004C9E';
  if (n.includes('rappibank') || n.includes('rappi')) return '#FF6B00';
  if (n.includes('lulo'))                       return '#00C896';
  return T.blue;
}

const nk = (ts?: number, pkg?: string) => `${ts ?? 0}_${pkg ?? ''}`;

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
  const [notifStatuses,  setNotifStatuses]  = useState<Record<string, 'processing' | 'done' | 'error'>>({});
  const [editTx,         setEditTx]         = useState<TransactionItem | null>(null);
  const [editCategory,   setEditCategory]   = useState('');
  const [editMerchant,   setEditMerchant]   = useState('');
  const [saving,         setSaving]         = useState(false);
  // Previene que processStored y el live listener procesen la misma notificación en paralelo
  const inFlightRef = useRef(new Set<string>());

  const checkPermission = useCallback(() => {
    if (Platform.OS === 'android') setHasPermission(isNotificationServiceEnabled());
    else setHasPermission(false);
  }, []);

  useEffect(() => {
    checkPermission();
    const sub = AppState.addEventListener('change', s => { if (s === 'active') checkPermission(); });
    return () => sub.remove();
  }, [checkPermission]);

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

  const sendNotificationToApi = useCallback(async (event: NotificationEvent): Promise<boolean> => {
    const token = await AsyncStorage.getItem('token');
    if (!token) return false;
    try {
      const res = await fetch(`${API_URL}/notifications/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: event.title ?? '',
          text: event.text ?? '',
          package_name: event.packageName ?? '',
          timestamp: event.timestamp ?? Date.now(),
        }),
      });
      if (res.ok) { fetchTransactions(); return true; }
      return false;
    } catch { return false; }
  }, [fetchTransactions]);

  async function markAndProcess(event: NotificationEvent) {
    const key = nk(event.timestamp, event.packageName);
    if (inFlightRef.current.has(key)) return false;
    inFlightRef.current.add(key);
    setNotifStatuses(prev => ({ ...prev, [key]: 'processing' }));
    const ok = await sendNotificationToApi(event);
    setNotifStatuses(prev => ({ ...prev, [key]: ok ? 'done' : 'error' }));
    if (!ok) inFlightRef.current.delete(key); // permitir reintento
    return ok;
  }

  async function retryNotification(event: NotificationEvent) {
    const ok = await markAndProcess(event);
    if (ok) {
      const raw = await AsyncStorage.getItem('finward_processed_ids');
      const ids = new Set<string>(raw ? JSON.parse(raw) : []);
      ids.add(nk(event.timestamp, event.packageName));
      await AsyncStorage.setItem('finward_processed_ids', JSON.stringify(Array.from(ids).slice(-1000)));
    }
  }

  async function retryAllErrors() {
    for (const n of notifications) {
      if (notifStatuses[nk(n.timestamp, n.packageName)] === 'error') await retryNotification(n);
    }
  }

  function clearNotifications() {
    Alert.alert(
      'Borrar notificaciones',
      '¿Borrar todas las notificaciones capturadas? Esto no afecta los movimientos ya procesados.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Borrar',
          style: 'destructive',
          onPress: async () => {
            clearPendingNotifications();
            await AsyncStorage.removeItem('finward_processed_ids');
            setNotifications([]);
            setNotifStatuses({});
          },
        },
      ],
    );
  }

  // On mount: load stored notifications and process any that haven't been sent
  // to the API yet (tracked via AsyncStorage to survive remounts).
  // Live notifications are processed immediately via the listener.
  useEffect(() => {
    if (!hasPermission) return;
    let active = true;

    async function processStored() {
      const stored = getPendingNotifications();
      if (stored.length === 0) return;
      setNotifications(stored.slice(0, 50));

      const raw = await AsyncStorage.getItem('finward_processed_ids');
      const processed = new Set<string>(raw ? JSON.parse(raw) : []);
      const pending = stored.filter(n => !processed.has(nk(n.timestamp, n.packageName)));

      for (const n of pending) {
        if (!active) break;
        const ok = await markAndProcess(n);
        if (ok) processed.add(nk(n.timestamp, n.packageName));
      }
      if (pending.length > 0 && active) {
        await AsyncStorage.setItem(
          'finward_processed_ids',
          JSON.stringify(Array.from(processed).slice(-1000)),
        );
      }
    }

    processStored();

    const sub = addNotificationListener(async (event) => {
      setNotifications(prev => [event, ...prev].slice(0, 50));
      const ok = await markAndProcess(event);
      if (ok) {
        const raw = await AsyncStorage.getItem('finward_processed_ids');
        const ids = new Set<string>(raw ? JSON.parse(raw) : []);
        ids.add(nk(event.timestamp, event.packageName));
        await AsyncStorage.setItem('finward_processed_ids', JSON.stringify(Array.from(ids).slice(-1000)));
      }
    });

    return () => { active = false; sub.remove(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasPermission, sendNotificationToApi]);

  const processingCount = Object.values(notifStatuses).filter(s => s === 'processing').length;
  const errorCount      = Object.values(notifStatuses).filter(s => s === 'error').length;

  function openEdit(tx: TransactionItem) {
    setEditTx(tx);
    setEditCategory(tx.categoria);
    setEditMerchant(tx.comercio);
  }

  async function saveEdit() {
    if (!editTx) return;
    setSaving(true);
    try {
      const token = await AsyncStorage.getItem('token');
      const body: Record<string, string> = {};
      if (editCategory !== editTx.categoria) body.category_name = editCategory;
      if (editMerchant !== editTx.comercio)  body.merchant_clean = editMerchant;
      if (Object.keys(body).length > 0) {
        await fetch(`${API_URL}/transactions/${editTx.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        });
        fetchTransactions();
      }
    } finally {
      setSaving(false);
      setEditTx(null);
    }
  }

  function handleTabPress(label: string) {
    if (label === 'Inicio')        navigation.replace('FinancialDashboard');
    if (label === 'Suscripciones') navigation.navigate('Subscriptions');
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

          {processingCount > 0 && (
            <View style={[s.statusBanner, s.statusBannerInfo]}>
              <ActivityIndicator size={12} color="rgba(255,255,255,0.9)" />
              <Text style={s.statusBannerText}>
                Procesando {processingCount} notificación{processingCount > 1 ? 'es' : ''}…
              </Text>
            </View>
          )}
          {errorCount > 0 && processingCount === 0 && (
            <TouchableOpacity style={[s.statusBanner, s.statusBannerError]} onPress={retryAllErrors} activeOpacity={0.8}>
              <Ionicons name="alert-circle-outline" size={14} color="rgba(255,255,255,0.9)" />
              <Text style={s.statusBannerText}>
                {errorCount} sin procesar · Toca para reintentar
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Body */}
        <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>

          {/* — Movimientos procesados — */}
          <Text style={[s.sectionTitle, { marginBottom: 10 }]}>MOVIMIENTOS PROCESADOS</Text>
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
                  <TouchableOpacity key={tx.id} style={[s.row, i > 0 && s.rowBorder]} onPress={() => openEdit(tx)} activeOpacity={0.7}>
                    <View style={[s.iconWrap, { backgroundColor: color + '18' }]}>
                      <Ionicons name={categoryIcon(tx.categoria)} size={18} color={color} />
                    </View>
                    <View style={s.info}>
                      <Text style={s.rowTitle} numberOfLines={1}>{tx.comercio}</Text>
                      <View style={s.bankBadgeRow}>
                        <Text style={s.rowMeta}>{tx.categoria}</Text>
                        {tx.banco ? (() => {
                          const bc = getBankColor(tx.banco);
                          return (
                            <View style={[s.bankBadge, { backgroundColor: bc + '22' }]}>
                              <Text style={[s.bankBadgeText, { color: bc }]}>{tx.banco}</Text>
                            </View>
                          );
                        })() : null}
                        <Text style={s.rowMeta}> · {formatFecha(tx.fecha)}</Text>
                      </View>
                    </View>
                    <View style={s.txRight}>
                      <Text style={[s.amount, { color: isIngreso ? T.green : T.red }]}>
                        {isIngreso ? '+' : '-'}{formatCOP(tx.monto)}
                      </Text>
                      <Ionicons name="pencil-outline" size={13} color={T.textLight} style={{ marginTop: 4 }} />
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* — Notificaciones capturadas — */}
          <View style={[s.sectionRow, s.sectionGap]}>
            <Text style={s.sectionTitle}>NOTIFICACIONES CAPTURADAS</Text>
            {notifications.length > 0 && (
              <TouchableOpacity onPress={clearNotifications} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="trash-outline" size={15} color={T.textLight} />
              </TouchableOpacity>
            )}
          </View>
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
                const { name: icon, color, label: bankLabel } = getBankMeta(item.packageName ?? '');
                const key    = nk(item.timestamp, item.packageName);
                const status = notifStatuses[key];
                return (
                  <View key={`${item.timestamp}-${i}`} style={[s.row, i > 0 && s.rowBorder]}>
                    <View style={[s.iconWrap, { backgroundColor: color + '18' }]}>
                      <Ionicons name={icon} size={18} color={color} />
                    </View>
                    <View style={s.info}>
                      <Text style={s.rowTitle} numberOfLines={1}>{item.title || 'Sin título'}</Text>
                      <View style={s.bankBadgeRow}>
                        <View style={[s.bankBadge, { backgroundColor: color + '18' }]}>
                          <Text style={[s.bankBadgeText, { color }]}>{bankLabel}</Text>
                        </View>
                        <Text style={s.rowMeta}> · {formatFecha(new Date(item.timestamp ?? Date.now()).toISOString())}</Text>
                      </View>
                    </View>
                    <View style={s.notifRight}>
                      <Text style={s.notifText} numberOfLines={2}>{item.text || '—'}</Text>
                      {status === 'processing' && (
                        <ActivityIndicator size={13} color={T.blue} style={s.statusIcon} />
                      )}
                      {status === 'done' && (
                        <Ionicons name="checkmark-circle" size={15} color={T.green} style={s.statusIcon} />
                      )}
                      {status === 'error' && (
                        <TouchableOpacity onPress={() => retryNotification(item)} style={s.statusIcon}>
                          <Ionicons name="refresh-circle" size={17} color={T.red} />
                        </TouchableOpacity>
                      )}
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

      {/* Modal de edición */}
      <Modal visible={editTx !== null} transparent animationType="slide" onRequestClose={() => setEditTx(null)}>
        <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setEditTx(null)}>
          <TouchableOpacity style={s.modalSheet} activeOpacity={1} onPress={() => {}}>
            <View style={s.modalHandle} />
            <Text style={s.modalTitle}>Editar movimiento</Text>
            {editTx && (
              <Text style={s.modalSubtitle}>{formatCOP(editTx.monto)} · {formatFecha(editTx.fecha)}</Text>
            )}

            <Text style={s.modalLabel}>Comercio</Text>
            <TextInput
              style={s.modalInput}
              value={editMerchant}
              onChangeText={setEditMerchant}
              placeholder="Nombre del comercio"
              placeholderTextColor={T.textLight}
            />

            <Text style={s.modalLabel}>Categoría</Text>
            <View style={s.catGrid}>
              {Object.keys(CATEGORY_COLOR).map(cat => {
                const color = categoryColor(cat);
                const selected = editCategory === cat;
                return (
                  <TouchableOpacity
                    key={cat}
                    style={[s.catChip, { borderColor: color, backgroundColor: selected ? color : 'transparent' }]}
                    onPress={() => setEditCategory(cat)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name={categoryIcon(cat)} size={13} color={selected ? '#fff' : color} />
                    <Text style={[s.catChipText, { color: selected ? '#fff' : color }]}>{cat}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={s.modalActions}>
              <TouchableOpacity style={s.modalBtnCancel} onPress={() => setEditTx(null)}>
                <Text style={s.modalBtnCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.modalBtnSave} onPress={saveEdit} disabled={saving}>
                {saving
                  ? <ActivityIndicator size={16} color="#fff" />
                  : <Text style={s.modalBtnSaveText}>Guardar</Text>
                }
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
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

  sectionRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 11, fontWeight: '700', color: T.textLight,
    letterSpacing: 0.5,
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
  rowMeta:   { fontSize: 11, color: T.textLight },
  bankBadgeRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginTop: 3, gap: 4 },
  bankBadge:    { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
  bankBadgeText:{ fontSize: 10, fontWeight: '600' },
  amount:    { fontSize: 14, fontWeight: '700' },
  txRight:   { alignItems: 'flex-end' },
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

  statusBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: 10, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
  },
  statusBannerInfo:  { backgroundColor: 'rgba(255,255,255,0.15)' },
  statusBannerError: { backgroundColor: 'rgba(217,79,79,0.35)' },
  statusBannerText:  { fontSize: 12, color: 'rgba(255,255,255,0.92)', flex: 1 },

  statusIcon: { alignSelf: 'flex-end', marginTop: 4 },

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: T.card, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 36,
  },
  modalHandle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: T.border,
    alignSelf: 'center', marginBottom: 20,
  },
  modalTitle:    { fontSize: 17, fontWeight: '700', color: T.text, marginBottom: 4 },
  modalSubtitle: { fontSize: 13, color: T.textMid, marginBottom: 20 },
  modalLabel:    { fontSize: 11, fontWeight: '700', color: T.textLight, letterSpacing: 0.5, marginBottom: 8 },
  modalInput: {
    borderWidth: 1, borderColor: T.border, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: T.text, marginBottom: 20,
  },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  catChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1.5, borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  catChipText: { fontSize: 12, fontWeight: '600' },
  modalActions: { flexDirection: 'row', gap: 12 },
  modalBtnCancel: {
    flex: 1, paddingVertical: 13, borderRadius: 12,
    borderWidth: 1, borderColor: T.border, alignItems: 'center',
  },
  modalBtnCancelText: { fontSize: 14, fontWeight: '600', color: T.textMid },
  modalBtnSave: {
    flex: 1, paddingVertical: 13, borderRadius: 12,
    backgroundColor: T.blue, alignItems: 'center',
  },
  modalBtnSaveText: { fontSize: 14, fontWeight: '600', color: '#fff' },
});
