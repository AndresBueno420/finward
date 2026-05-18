import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import {
  AppState,
  FlatList,
  Platform,
  StyleSheet,
  Text,
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

type Props = NativeStackScreenProps<RootStackParamList, 'Dashboard'>;

const NAV_TABS: { label: string; icon: keyof typeof Ionicons.glyphMap; active: boolean }[] = [
  { label: 'Inicio',        icon: 'home-outline',          active: false },
  { label: 'Suscripciones', icon: 'repeat-outline',        active: false },
  { label: 'Alertas',       icon: 'notifications',         active: true  },
  { label: 'Perfil',        icon: 'person-outline',        active: false },
];

function getBankIcon(packageName: string): { name: keyof typeof Ionicons.glyphMap; color: string } {
  if (packageName.includes('bancolombia')) return { name: 'business-outline',   color: '#FFB800' };
  if (packageName.includes('nequi'))       return { name: 'wallet-outline',     color: '#6C1D8E' };
  if (packageName.includes('nu.product'))  return { name: 'card-outline',       color: '#820AD1' };
  if (packageName.includes('davivienda') || packageName.includes('daviplata'))
                                           return { name: 'card-outline',       color: '#D40000' };
  if (packageName.includes('bbva'))        return { name: 'card-outline',       color: '#004C9E' };
  if (packageName.includes('bold') || packageName.includes('rappi'))
                                           return { name: 'storefront-outline', color: '#FF6B00' };
  return { name: 'card-outline', color: T.blue };
}

export default function DashboardScreen({ navigation }: Props) {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [notifications, setNotifications] = useState<NotificationEvent[]>([]);

  const checkPermission = useCallback(() => {
    if (Platform.OS === 'android') {
      setHasPermission(isNotificationServiceEnabled());
    } else {
      setHasPermission(false);
    }
  }, []);

  useEffect(() => {
    checkPermission();
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') checkPermission();
    });
    return () => sub.remove();
  }, [checkPermission]);

  useEffect(() => {
    if (!hasPermission) return;

    const pending = getPendingNotifications();
    clearPendingNotifications();
    if (pending.length > 0) setNotifications(pending.slice(0, 50));

    const sub = addNotificationListener((event) => {
      setNotifications((prev) => [event, ...prev].slice(0, 50));
    });
    return () => sub.remove();
  }, [hasPermission]);

  function handleTabPress(label: string) {
    if (label === 'Inicio') navigation.replace('FinancialDashboard');
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.headerGreeting}>Buenos días,</Text>
              <Text style={styles.headerName}>Alertas</Text>
            </View>
            <View style={styles.bellWrap}>
              <Ionicons name="notifications-outline" size={20} color="#fff" />
              {hasPermission && notifications.length > 0 && (
                <View style={styles.bellDot} />
              )}
            </View>
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>NOTIFICACIONES CAPTURADAS</Text>
            <Text style={styles.summaryCount}>{notifications.length}</Text>
            <Text style={styles.summaryHint}>
              {hasPermission ? 'Escuchando notificaciones bancarias' : 'Permiso pendiente'}
            </Text>
          </View>
        </View>

        {/* Body */}
        {hasPermission === null ? (
          <View style={styles.centered}>
            <Text style={styles.hint}>Verificando permisos…</Text>
          </View>
        ) : !hasPermission ? (
          <View style={styles.centered}>
            <View style={styles.permCard}>
              <View style={styles.permIconWrap}>
                <Ionicons name="notifications-circle-outline" size={52} color={T.blue} />
              </View>
              <Text style={styles.permTitle}>Permiso requerido</Text>
              <Text style={styles.permBody}>
                FinWard necesita acceso a las notificaciones para detectar
                movimientos bancarios automáticamente.
              </Text>
              <TouchableOpacity style={styles.permButton} onPress={openNotificationSettings} activeOpacity={0.85}>
                <Text style={styles.permButtonText}>Conceder acceso</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <FlatList
            data={notifications}
            keyExtractor={(item, i) => `${item.timestamp}-${i}`}
            contentContainerStyle={styles.list}
            ListHeaderComponent={
              <Text style={styles.sectionTitle}>
                {notifications.length === 0 ? 'Sin notificaciones aún' : 'Notificaciones recientes'}
              </Text>
            }
            ListEmptyComponent={
              <View style={styles.emptyCard}>
                <Ionicons name="mail-outline" size={36} color={T.textLight} />
                <Text style={styles.emptyText}>
                  Esperando notificaciones bancarias…{'\n'}Realiza una transacción para verla aquí.
                </Text>
              </View>
            }
            renderItem={({ item, index }) => {
              const { name: iconName, color: iconColor } = getBankIcon(item.packageName ?? '');
              return (
                <View style={[styles.txCard, index > 0 && styles.txCardBorder]}>
                  <View style={[styles.txIconWrap, { backgroundColor: iconColor + '18' }]}>
                    <Ionicons name={iconName} size={20} color={iconColor} />
                  </View>
                  <View style={styles.txInfo}>
                    <Text style={styles.txTitle} numberOfLines={1}>
                      {item.title || 'Sin título'}
                    </Text>
                    <Text style={styles.txMeta} numberOfLines={1}>
                      {item.packageName}
                    </Text>
                  </View>
                  <View style={styles.txRight}>
                    <Text style={styles.txText} numberOfLines={2}>
                      {item.text || '—'}
                    </Text>
                  </View>
                </View>
              );
            }}
          />
        )}

        {/* Bottom nav */}
        <View style={styles.bottomNav}>
          {NAV_TABS.map((tab) => (
            <TouchableOpacity
              key={tab.label}
              style={styles.navTab}
              onPress={() => handleTabPress(tab.label)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={tab.icon}
                size={22}
                color={tab.active ? T.blue : T.textLight}
              />
              <Text style={[styles.navLabel, tab.active && styles.navLabelActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea:  { flex: 1, backgroundColor: T.blue },
  container: { flex: 1, backgroundColor: T.bg },

  /* Header */
  header: {
    backgroundColor: T.blue,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 32,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerGreeting: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.75)',
    marginBottom: 2,
  },
  headerName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  bellWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FF6B6B',
    borderWidth: 2,
    borderColor: T.blue,
  },
  summaryCard: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  summaryLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  summaryCount: {
    fontSize: 36,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -1,
  },
  summaryHint: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.65)',
    marginTop: 4,
  },

  /* Body states */
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  hint: { fontSize: 15, color: T.textLight, textAlign: 'center' },

  /* Permission card */
  permCard: {
    backgroundColor: T.card,
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 4,
  },
  permIconWrap: { marginBottom: 16 },
  permTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: T.text,
    marginBottom: 10,
    textAlign: 'center',
  },
  permBody: {
    fontSize: 14,
    color: T.textMid,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 24,
  },
  permButton: {
    backgroundColor: T.blue,
    paddingVertical: 14,
    paddingHorizontal: 36,
    borderRadius: 14,
    shadowColor: T.blue,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.27,
    shadowRadius: 10,
    elevation: 6,
  },
  permButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },

  /* Notification list */
  list:         { padding: 20, paddingBottom: 8 },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: T.text, marginBottom: 12 },
  emptyCard: {
    backgroundColor: T.card,
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 2,
  },
  emptyText: { fontSize: 14, color: T.textMid, textAlign: 'center', lineHeight: 22 },
  txCard: {
    backgroundColor: T.card,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  txCardBorder: { borderTopWidth: 1, borderTopColor: T.border },
  txIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  txInfo:  { flex: 1, minWidth: 0 },
  txTitle: { fontSize: 14, fontWeight: '600', color: T.text },
  txMeta:  { fontSize: 11, color: T.textLight, marginTop: 2 },
  txRight: { maxWidth: 120, alignItems: 'flex-end' },
  txText:  { fontSize: 12, color: T.textMid, textAlign: 'right' },

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
  navLabel:       { fontSize: 10, color: T.textLight },
  navLabelActive: { color: T.blue, fontWeight: '600' },
});
