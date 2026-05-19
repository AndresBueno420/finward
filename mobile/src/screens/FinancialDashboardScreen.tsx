import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RootStackParamList } from '../navigation/AppNavigator';

const API_URL = 'http://10.156.176.225:8080';

const T = {
  blue:       '#4A6FA5',
  blueLight:  '#EEF2F9',
  bg:         '#F5F7FA',
  card:       '#FFFFFF',
  text:       '#1A1D23',
  textMid:    '#5A6070',
  textLight:  '#9AA0AD',
  border:     '#E8EAF0',
  green:      '#2E8B6A',
  greenLight: '#E6F5F0',
  red:        '#D94F4F',
  redLight:   '#FDF0F0',
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
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatFecha(iso: string): string {
  const date = new Date(iso);
  const now  = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 86_400_000);
  if (diff === 0) return 'Hoy';
  if (diff === 1) return 'Ayer';
  if (diff < 7)  return `Hace ${diff} días`;
  return date.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
}

type CategorySummary = {
  nombre:     string;
  tipo:       string;
  total:      number;
  count:      number;
  porcentaje: number;
};

type TransactionItem = {
  id:        string;
  comercio:  string;
  categoria: string;
  tipo:      string;
  monto:     number;
  divisa:    string;
  fecha:     string;
};

type SummaryData = {
  mes:            string;
  total_gastos:   number;
  total_ingresos: number;
  por_categoria:  CategorySummary[];
  transacciones:  TransactionItem[];
};

type Props = NativeStackScreenProps<RootStackParamList, 'FinancialDashboard'>;

const NAV_TABS: { label: string; icon: keyof typeof Ionicons.glyphMap; active: boolean }[] = [
  { label: 'Inicio',          icon: 'home',                  active: true  },
  { label: 'Suscripciones',   icon: 'repeat-outline',        active: false },
  { label: 'Notificaciones',  icon: 'notifications-outline', active: false },
  { label: 'Perfil',          icon: 'person-outline',        active: false },
];

export default function FinancialDashboardScreen({ navigation }: Props) {
  const [data,       setData]       = useState<SummaryData | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const fetchSummary = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else           setLoading(true);
    setError(null);

    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) { navigation.replace('Login'); return; }

      const now = new Date();
      const res = await fetch(
        `${API_URL}/summary?month=${now.getMonth() + 1}&year=${now.getFullYear()}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );

      if (res.status === 401) {
        await AsyncStorage.removeItem('token');
        navigation.replace('Login');
        return;
      }
      if (!res.ok) throw new Error('Error al cargar el resumen');

      setData(await res.json());
    } catch (e: any) {
      setError(e.message ?? 'Error de conexión');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [navigation]);

  useEffect(() => { fetchSummary(); }, [fetchSummary]);

  function handleTabPress(label: string) {
    if (label === 'Notificaciones') navigation.navigate('Dashboard');
    if (label === 'Suscripciones')  navigation.navigate('Subscriptions');
  }

  const gastos  = data?.por_categoria.filter(c => c.tipo === 'gasto') ?? [];
  const balance = (data?.total_ingresos ?? 0) - (data?.total_gastos ?? 0);

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.root}>
        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchSummary(true)}
              tintColor="#fff"
            />
          }
        >
          {/* ── HEADER ── */}
          <View style={s.header}>
            <View style={s.headerTop}>
              <View>
                <Text style={s.greeting}>Buenos días</Text>
                <Text style={s.headerMonth}>{data?.mes ?? '—'}</Text>
              </View>
              <View style={s.avatarWrap}>
                <Ionicons name="person-outline" size={20} color="#fff" />
              </View>
            </View>

            <View style={s.headerStatsRow}>
              <View style={s.headerStatCard}>
                <Text style={s.headerStatLabel}>GASTOS</Text>
                <Text style={s.headerStatAmount}>{formatCOP(data?.total_gastos ?? 0)}</Text>
              </View>
              <View style={s.headerStatDivider} />
              <View style={s.headerStatCard}>
                <Text style={s.headerStatLabel}>INGRESOS</Text>
                <Text style={[s.headerStatAmount, { color: '#6EE7B7' }]}>
                  {formatCOP(data?.total_ingresos ?? 0)}
                </Text>
              </View>
            </View>
          </View>

          {/* ── BODY ── */}
          <View style={s.body}>
            {loading ? (
              <View style={s.centered}>
                <ActivityIndicator size="large" color={T.blue} />
              </View>
            ) : error ? (
              <View style={s.centered}>
                <Ionicons name="cloud-offline-outline" size={40} color={T.textLight} />
                <Text style={s.errorText}>{error}</Text>
                <TouchableOpacity style={s.retryBtn} onPress={() => fetchSummary()} activeOpacity={0.8}>
                  <Text style={s.retryText}>Reintentar</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {/* GASTOS POR CATEGORÍA */}
                {gastos.length > 0 ? (
                  <>
                    <Text style={s.sectionTitle}>GASTOS POR CATEGORÍA</Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={s.categoryList}
                    >
                      {gastos.map(cat => {
                        const color = categoryColor(cat.nombre);
                        return (
                          <View key={cat.nombre} style={s.categoryCard}>
                            <View style={[s.categoryIconWrap, { backgroundColor: color + '20' }]}>
                              <Ionicons name={categoryIcon(cat.nombre)} size={20} color={color} />
                            </View>
                            <Text style={s.categoryName} numberOfLines={1}>{cat.nombre}</Text>
                            <Text style={s.categoryAmount}>{formatCOP(cat.total)}</Text>
                            <View style={s.barBg}>
                              <View style={[s.barFill, {
                                width: `${Math.min(cat.porcentaje, 100)}%` as any,
                                backgroundColor: color,
                              }]} />
                            </View>
                            <Text style={[s.categoryPct, { color }]}>
                              {Math.round(cat.porcentaje)}%
                            </Text>
                          </View>
                        );
                      })}
                    </ScrollView>
                  </>
                ) : (
                  <View style={s.emptyCard}>
                    <Ionicons name="receipt-outline" size={36} color={T.textLight} />
                    <Text style={s.emptyText}>
                      Sin gastos registrados este mes.
                    </Text>
                  </View>
                )}

                {/* BALANCE */}
                <Text style={[s.sectionTitle, { marginTop: 4 }]}>BALANCE DEL MES</Text>
                <View style={s.balanceCard}>
                  <View style={s.balanceRow}>
                    <View style={[s.balanceDot, { backgroundColor: T.red }]} />
                    <Text style={s.balanceLabel}>Gastos</Text>
                    <Text style={[s.balanceValue, { color: T.red }]}>
                      -{formatCOP(data?.total_gastos ?? 0)}
                    </Text>
                  </View>
                  <View style={s.balanceRow}>
                    <View style={[s.balanceDot, { backgroundColor: T.green }]} />
                    <Text style={s.balanceLabel}>Ingresos</Text>
                    <Text style={[s.balanceValue, { color: T.green }]}>
                      +{formatCOP(data?.total_ingresos ?? 0)}
                    </Text>
                  </View>
                  <View style={s.balanceSeparator} />
                  <View style={s.balanceRow}>
                    <Text style={s.balanceTotalLabel}>Resultado</Text>
                    <Text style={[s.balanceTotalValue, { color: balance >= 0 ? T.green : T.red }]}>
                      {balance >= 0 ? '+' : ''}{formatCOP(balance)}
                    </Text>
                  </View>
                </View>
              </>
            )}
          </View>
        </ScrollView>

        {/* ── BOTTOM NAV ── */}
        <View style={s.bottomNav}>
          {NAV_TABS.map(tab => (
            <TouchableOpacity
              key={tab.label}
              style={s.navTab}
              onPress={() => handleTabPress(tab.label)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={tab.icon}
                size={22}
                color={tab.active ? T.blue : T.textLight}
              />
              <Text style={[s.navLabel, tab.active && s.navLabelActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.blue },
  root: { flex: 1, backgroundColor: T.bg },

  scroll:        { flex: 1 },
  scrollContent: { paddingBottom: 16 },

  /* Header */
  header: {
    backgroundColor: T.blue,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 28,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  greeting: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 2,
  },
  headerMonth: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  avatarWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Header stats */
  headerStatsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    overflow: 'hidden',
  },
  headerStatCard: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  headerStatDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginVertical: 10,
  },
  headerStatLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  headerStatAmount: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.5,
  },

  /* Body */
  body: { paddingTop: 20 },

  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  errorText: { fontSize: 14, color: T.textMid, textAlign: 'center' },
  retryBtn: {
    backgroundColor: T.blue,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 12,
  },
  retryText: { color: '#fff', fontWeight: '600', fontSize: 14 },

  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: T.textLight,
    letterSpacing: 0.5,
    marginHorizontal: 20,
    marginBottom: 12,
  },

  /* Category cards */
  categoryList: { paddingHorizontal: 20, gap: 10, paddingBottom: 20 },
  categoryCard: {
    backgroundColor: T.card,
    borderRadius: 16,
    padding: 14,
    width: 136,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  categoryIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  categoryName: {
    fontSize: 12,
    color: T.textMid,
    marginBottom: 4,
  },
  categoryAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: T.text,
    marginBottom: 8,
  },
  barBg: {
    height: 4,
    backgroundColor: T.border,
    borderRadius: 2,
    marginBottom: 4,
    overflow: 'hidden',
  },
  barFill: { height: 4, borderRadius: 2 },
  categoryPct: { fontSize: 11, fontWeight: '600' },

  /* Balance card */
  balanceCard: {
    marginHorizontal: 20,
    backgroundColor: T.card,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 8,
    gap: 10,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  balanceDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  balanceLabel: {
    flex: 1,
    fontSize: 14,
    color: T.textMid,
  },
  balanceValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  balanceSeparator: {
    height: 1,
    backgroundColor: T.border,
    marginVertical: 2,
  },
  balanceTotalLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: T.text,
  },
  balanceTotalValue: {
    fontSize: 15,
    fontWeight: '700',
  },

  /* Empty state */
  emptyCard: {
    marginHorizontal: 20,
    backgroundColor: T.card,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  emptyText: {
    fontSize: 13,
    color: T.textMid,
    textAlign: 'center',
    lineHeight: 20,
  },

  /* Bottom nav */
  bottomNav: {
    height: 60,
    backgroundColor: T.card,
    borderTopWidth: 1,
    borderTopColor: T.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
  },
  navTab: {
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  navLabel: {
    fontSize: 10,
    color: T.textLight,
  },
  navLabelActive: {
    color: T.blue,
    fontWeight: '600',
  },
});
