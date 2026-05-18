import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RootStackParamList } from '../navigation/AppNavigator';

const API_URL = 'http://192.168.86.241:8080';

const T = {
  blue:      '#4A6FA5',
  blueLight: '#EEF2F9',
  bg:        '#F5F7FA',
  card:      '#FFFFFF',
  text:      '#1A1D23',
  textMid:   '#5A6070',
  textLight: '#9AA0AD',
  border:    '#E8EAF0',
  green:     '#2E8B6A',
  red:       '#D94F4F',
};

const NAV_TABS: { label: string; icon: keyof typeof Ionicons.glyphMap; active: boolean }[] = [
  { label: 'Inicio',         icon: 'home-outline',   active: false },
  { label: 'Suscripciones',  icon: 'repeat',         active: true  },
  { label: 'Notificaciones', icon: 'notifications-outline', active: false },
  { label: 'Perfil',         icon: 'person-outline', active: false },
];

// Accent colors cycled by index so each card looks distinct
const ACCENT_COLORS = ['#8B5CF6', '#EC4899', '#3B82F6', '#F97316', '#10B981', '#EF4444', '#F59E0B'];
function accentColor(index: number) { return ACCENT_COLORS[index % ACCENT_COLORS.length]; }

function serviceIcon(name: string): keyof typeof Ionicons.glyphMap {
  const n = name.toLowerCase();
  if (n.includes('netflix') || n.includes('disney') || n.includes('hbo') || n.includes('prime')) return 'tv-outline';
  if (n.includes('spotify') || n.includes('deezer') || n.includes('apple music'))               return 'musical-notes-outline';
  if (n.includes('youtube'))  return 'logo-youtube';
  if (n.includes('icloud') || n.includes('google one') || n.includes('dropbox'))                return 'cloud-outline';
  if (n.includes('gym') || n.includes('fitness') || n.includes('smart fit'))                    return 'barbell-outline';
  if (n.includes('adobe'))    return 'color-palette-outline';
  return 'repeat-outline';
}

function formatCOP(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return 'Indefinido';
  const [y, m, d] = iso.split('-');
  const months = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  return `${parseInt(d, 10)} ${months[parseInt(m, 10) - 1]} ${y}`;
}

type Subscription = {
  id: string;
  servicio: string;
  metodo_pago: string;
  monto: number;
  divisa: string;
  frecuencia: string;
  fecha_inicio: string;
  fecha_fin: string | null;
  proximo_pago: string;
};

type EditState = { end_date: string; amount: string };

type Props = NativeStackScreenProps<RootStackParamList, 'Subscriptions'>;

export default function SubscriptionsScreen({ navigation }: Props) {
  const [subs,      setSubs]      = useState<Subscription[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState>({ end_date: '', amount: '' });

  const fetchSubs = useCallback(async () => {
    const token = await AsyncStorage.getItem('token');
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/subscriptions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const body = await res.json();
        setSubs(body.suscripciones ?? []);
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchSubs(); }, [fetchSubs]);

  function startEdit(sub: Subscription) {
    setEditingId(sub.id);
    setEditState({ end_date: sub.fecha_fin ?? '', amount: String(sub.monto) });
  }

  function cancelEdit() { setEditingId(null); }

  async function saveEdit(id: string) {
    const token = await AsyncStorage.getItem('token');
    if (!token) return;
    const amount = parseFloat(editState.amount);
    try {
      await fetch(`${API_URL}/subscriptions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          end_date: editState.end_date || '',
          amount: isNaN(amount) ? undefined : amount,
        }),
      });
      setEditingId(null);
      fetchSubs();
    } catch {}
  }

  async function deleteSub(id: string) {
    Alert.alert(
      'Eliminar suscripción',
      '¿Seguro que deseas eliminar esta suscripción?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar', style: 'destructive',
          onPress: async () => {
            const token = await AsyncStorage.getItem('token');
            if (!token) return;
            try {
              await fetch(`${API_URL}/subscriptions/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
              });
              fetchSubs();
            } catch {}
          },
        },
      ],
    );
  }

  function handleTabPress(label: string) {
    if (label === 'Inicio')         navigation.replace('FinancialDashboard');
    if (label === 'Notificaciones') navigation.navigate('Dashboard');
  }

  return (
    <SafeAreaView style={s.safeArea}>
      <View style={s.container}>

        {/* Header */}
        <View style={s.header}>
          <View style={s.headerTop}>
            <View>
              <Text style={s.greeting}>Gestión</Text>
              <Text style={s.title}>Suscripciones</Text>
            </View>
            <View style={s.countBadge}>
              <Text style={s.countText}>{subs.length}</Text>
            </View>
          </View>
          {subs.length > 0 && (
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>Total mensual estimado</Text>
              <Text style={s.totalAmount}>
                {formatCOP(subs.reduce((acc, s) => acc + s.monto, 0))}
              </Text>
            </View>
          )}
        </View>

        {/* Body */}
        <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
          {loading ? (
            <View style={s.centered}>
              <ActivityIndicator color={T.blue} />
            </View>
          ) : subs.length === 0 ? (
            <View style={s.emptyCard}>
              <Ionicons name="repeat-outline" size={40} color={T.textLight} />
              <Text style={s.emptyTitle}>Sin suscripciones</Text>
              <Text style={s.emptyBody}>
                Cuando FinWard detecte un pago recurrente lo verás aquí.
              </Text>
            </View>
          ) : (
            subs.map((sub, i) => {
              const color   = accentColor(i);
              const isEditing = editingId === sub.id;
              return (
                <View key={sub.id} style={s.card}>

                  {/* Card header row */}
                  <View style={s.cardHeader}>
                    <View style={[s.iconWrap, { backgroundColor: color + '1A' }]}>
                      <Ionicons name={serviceIcon(sub.servicio)} size={22} color={color} />
                    </View>
                    <View style={s.cardMeta}>
                      <Text style={s.cardTitle} numberOfLines={1}>{sub.servicio}</Text>
                      {sub.metodo_pago ? (
                        <View style={s.badgeRow}>
                          <Ionicons name="card-outline" size={11} color={T.textLight} />
                          <Text style={s.badge}>{sub.metodo_pago}</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={[s.cardAmount, { color }]}>{formatCOP(sub.monto)}</Text>
                  </View>

                  <View style={s.divider} />

                  {/* Normal state: dates */}
                  {!isEditing && (
                    <View style={s.datesRow}>
                      <View style={s.datePill}>
                        <Ionicons name="calendar-outline" size={12} color={T.textLight} />
                        <Text style={s.dateLabel}>Inicio</Text>
                        <Text style={s.dateValue}>{formatDate(sub.fecha_inicio)}</Text>
                      </View>
                      <Ionicons name="arrow-forward-outline" size={14} color={T.border} />
                      <View style={s.datePill}>
                        <Ionicons name="calendar-outline" size={12} color={T.textLight} />
                        <Text style={s.dateLabel}>Fin</Text>
                        <Text style={[s.dateValue, !sub.fecha_fin && { color: T.textLight, fontStyle: 'italic' }]}>
                          {formatDate(sub.fecha_fin)}
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* Edit state */}
                  {isEditing && (
                    <View style={s.editBlock}>
                      <View style={s.inputRow}>
                        <Text style={s.inputLabel}>Monto (COP)</Text>
                        <TextInput
                          style={s.input}
                          keyboardType="numeric"
                          value={editState.amount}
                          onChangeText={v => setEditState(p => ({ ...p, amount: v }))}
                          placeholder="ej. 45900"
                          placeholderTextColor={T.textLight}
                        />
                      </View>
                      <View style={s.inputRow}>
                        <Text style={s.inputLabel}>Fecha fin (AAAA-MM-DD)</Text>
                        <TextInput
                          style={s.input}
                          value={editState.end_date}
                          onChangeText={v => setEditState(p => ({ ...p, end_date: v }))}
                          placeholder="ej. 2026-01-15  (vacío = indefinido)"
                          placeholderTextColor={T.textLight}
                        />
                      </View>
                      <View style={s.editActions}>
                        <TouchableOpacity style={s.btnCancel} onPress={cancelEdit} activeOpacity={0.8}>
                          <Text style={s.btnCancelText}>Cancelar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[s.btnSave, { backgroundColor: color }]} onPress={() => saveEdit(sub.id)} activeOpacity={0.8}>
                          <Text style={s.btnSaveText}>Guardar</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}

                  {/* Action buttons */}
                  {!isEditing && (
                    <View style={s.actions}>
                      <Text style={s.nextLabel}>
                        Próximo pago: <Text style={{ color: T.text, fontWeight: '600' }}>{formatDate(sub.proximo_pago)}</Text>
                      </Text>
                      <View style={s.actionBtns}>
                        <TouchableOpacity style={s.actionBtn} onPress={() => startEdit(sub)} activeOpacity={0.7}>
                          <Ionicons name="pencil-outline" size={16} color={T.blue} />
                        </TouchableOpacity>
                        <TouchableOpacity style={[s.actionBtn, s.actionBtnRed]} onPress={() => deleteSub(sub.id)} activeOpacity={0.7}>
                          <Ionicons name="trash-outline" size={16} color={T.red} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}

                </View>
              );
            })
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
    paddingBottom: 20,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  greeting: { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginBottom: 2 },
  title:    { fontSize: 20, fontWeight: '700', color: '#fff' },
  countBadge: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  countText: { fontSize: 16, fontWeight: '700', color: '#fff' },

  totalRow: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel:  { fontSize: 12, color: 'rgba(255,255,255,0.7)' },
  totalAmount: { fontSize: 16, fontWeight: '700', color: '#fff' },

  scroll:        { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 12 },

  centered: { flex: 1, alignItems: 'center', paddingTop: 60 },

  emptyCard: {
    backgroundColor: T.card, borderRadius: 20, padding: 36,
    alignItems: 'center', gap: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: T.text },
  emptyBody:  { fontSize: 13, color: T.textMid, textAlign: 'center', lineHeight: 19 },

  card: {
    backgroundColor: T.card, borderRadius: 18, marginBottom: 14,
    overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 10, elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12,
  },
  iconWrap: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  cardMeta: { flex: 1, minWidth: 0 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: T.text },
  badgeRow:  { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  badge:     { fontSize: 11, color: T.textLight },
  cardAmount:{ fontSize: 16, fontWeight: '700' },

  divider: { height: 1, backgroundColor: T.border, marginHorizontal: 16 },

  datesRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  datePill:  { flex: 1, gap: 2 },
  dateLabel: { fontSize: 10, color: T.textLight, textTransform: 'uppercase', letterSpacing: 0.4 },
  dateValue: { fontSize: 13, fontWeight: '600', color: T.text },

  actions: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 14,
  },
  nextLabel:  { fontSize: 11, color: T.textLight },
  actionBtns: { flexDirection: 'row', gap: 8 },
  actionBtn:  {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: T.blueLight,
    alignItems: 'center', justifyContent: 'center',
  },
  actionBtnRed: { backgroundColor: '#FDECEA' },

  editBlock: { paddingHorizontal: 16, paddingVertical: 12, gap: 10 },
  inputRow:  { gap: 4 },
  inputLabel:{ fontSize: 11, color: T.textLight, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  input: {
    borderWidth: 1, borderColor: T.border, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 9,
    fontSize: 14, color: T.text, backgroundColor: T.bg,
  },
  editActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  btnCancel: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    borderWidth: 1, borderColor: T.border,
    alignItems: 'center',
  },
  btnCancelText: { fontSize: 14, color: T.textMid, fontWeight: '600' },
  btnSave: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    alignItems: 'center',
  },
  btnSaveText: { fontSize: 14, color: '#fff', fontWeight: '600' },

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
