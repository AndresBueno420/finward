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

const API_URL = 'http://192.168.86.241:8080';

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
  { label: 'Inicio',        icon: 'home',                  active: true  },
  { label: 'Suscripciones', icon: 'repeat-outline',        active: false },
  { label: 'Alertas',       icon: 'notifications-outline', active: false },
  { label: 'Perfil',        icon: 'person-outline',        active: false },
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
    if (label === 'Alertas') navigation.navigate('Dashboard');
  }

  const gastos = data?.por_categoria.filter(c => c.tipo === 'gasto') ?? [];
  const txs    = data?.transacciones ?? [];

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

            <View style={s.summaryCard}>
              <Text style={s.summaryLabel}>GASTOS DEL MES</Text>
              <Text style={s.summaryAmount}>
                {formatCOP(data?.total_gastos ?? 0)}
              </Text>
              {(data?.total_ingresos ?? 0) > 0 && (
                <View style={s.ingresoRow}>
                  <Ionicons name="arrow-down-outline" size={12} color={T.green} />
                  <Text style={s.ingresoText}>
                    {formatCOP(data!.total_ingresos)} recibidos
                  </Text>
                </View>
              )}
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
                {/* CATEGORÍAS */}
                {gastos.length > 0 && (
                  <>
                    <Text style={s.sectionTitle}>POR CATEGORÍA</Text>
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
                )}

                {/* TRANSACCIONES */}
                <Text style={s.sectionTitle}>
                  {txs.length > 0 ? 'ÚLTIMOS MOVIMIENTOS' : 'MOVIMIENTOS DEL MES'}
                </Text>

                {txs.length === 0 ? (
                  <View style={s.emptyCard}>
                    <Ionicons name="receipt-outline" size={36} color={T.textLight} />
                    <Text style={s.emptyText}>
                      Sin movimientos procesados este mes.{'\n'}
                      Las transacciones aparecerán aquí una vez capturadas.
                    </Text>
                  </View>
                ) : (
                  <View style={s.txList}>
                    {txs.map((tx, i) => {
                      const isIngreso = tx.tipo === 'ingreso';
                      const color     = categoryColor(tx.categoria);
                      return (
                        <View key={tx.id} style={[s.txRow, i > 0 && s.txRowBorder]}>
                          <View style={[s.txIconWrap, { backgroundColor: color + '18' }]}>
                            <Ionicons name={categoryIcon(tx.categoria)} size={18} color={color} />
                          </View>
                          <View style={s.txInfo}>
                            <Text style={s.txComercio} numberOfLines={1}>{tx.comercio}</Text>
                            <Text style={s.txMeta}>
                              {tx.categoria} · {formatFecha(tx.fecha)}
                            </Text>
                          </View>
                          <Text style={[s.txMonto, { color: isIngreso ? T.green : T.red }]}>
                            {isIngreso ? '+' : '-'}{formatCOP(tx.monto)}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                )}
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

  /* Summary card */
  summaryCard: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  summaryLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.65)',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  summaryAmount: {
    fontSize: 34,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -1,
  },
  ingresoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  ingresoText: {
    fontSize: 13,
    color: T.green,
    fontWeight: '500',
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

  /* Transaction list */
  txList: {
    marginHorizontal: 20,
    backgroundColor: T.card,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 8,
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 12,
  },
  txRowBorder: {
    borderTopWidth: 1,
    borderTopColor: T.border,
  },
  txIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  txInfo:    { flex: 1, minWidth: 0 },
  txComercio: {
    fontSize: 14,
    fontWeight: '600',
    color: T.text,
  },
  txMeta: {
    fontSize: 11,
    color: T.textLight,
    marginTop: 2,
  },
  txMonto: {
    fontSize: 14,
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
