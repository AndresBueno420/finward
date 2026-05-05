import { useCallback, useEffect, useState } from 'react';
import {
  AppState,
  FlatList,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  addNotificationListener,
  isNotificationServiceEnabled,
  NotificationEvent,
  openNotificationSettings,
} from 'notification-listener';

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
  greenLight:'#E6F5F0',
  red:       '#D94F4F',
  redLight:  '#FDF0F0',
  orange:    '#E07A2F',
};

/* Bottom nav tab data */
const NAV_TABS = [
  { label: 'Inicio',        icon: '🏠', active: true  },
  { label: 'Suscripciones', icon: '📦', active: false },
  { label: 'Alertas',       icon: '🔔', active: false },
  { label: 'Perfil',        icon: '👤', active: false },
];

export default function DashboardScreen() {
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
    const sub = addNotificationListener((event) => {
      setNotifications((prev) => [event, ...prev].slice(0, 50));
    });
    return () => sub.remove();
  }, [hasPermission]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.headerGreeting}>Buenos días,</Text>
              <Text style={styles.headerName}>Mi cuenta 👋</Text>
            </View>
            <View style={styles.bellWrap}>
              <Text style={styles.bellIcon}>🔔</Text>
              {hasPermission && notifications.length > 0 && (
                <View style={styles.bellDot} />
              )}
            </View>
          </View>

          {/* Summary card inside header */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>MOVIMIENTOS DETECTADOS</Text>
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
              <Text style={styles.permIcon}>🔔</Text>
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
            keyExtractor={(_, i) => i.toString()}
            contentContainerStyle={styles.list}
            ListHeaderComponent={
              <Text style={styles.sectionTitle}>
                {notifications.length === 0 ? 'Sin movimientos aún' : 'Últimos movimientos'}
              </Text>
            }
            ListEmptyComponent={
              <View style={styles.emptyCard}>
                <Text style={styles.emptyIcon}>📬</Text>
                <Text style={styles.emptyText}>
                  Esperando notificaciones bancarias…{'\n'}Realiza una transacción para verla aquí.
                </Text>
              </View>
            }
            renderItem={({ item, index }) => (
              <View style={[styles.txCard, index > 0 && styles.txCardBorder]}>
                <View style={styles.txIconWrap}>
                  <Text style={styles.txIconText}>
                    {item.packageName?.includes('bancolombia') ? '🏦'
                      : item.packageName?.includes('nequi') ? '💜'
                      : item.packageName?.includes('nu') || item.packageName?.includes('nubank') ? '💜'
                      : '📱'}
                  </Text>
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
            )}
          />
        )}

        {/* Bottom nav */}
        <View style={styles.bottomNav}>
          {NAV_TABS.map((tab) => (
            <View key={tab.label} style={styles.navTab}>
              <Text style={[styles.navIcon, tab.active && styles.navIconActive]}>
                {tab.icon}
              </Text>
              <Text style={[styles.navLabel, tab.active && styles.navLabelActive]}>
                {tab.label}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: T.blue,
  },
  container: {
    flex: 1,
    backgroundColor: T.bg,
  },

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
  bellIcon: {
    fontSize: 18,
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
  hint: {
    fontSize: 15,
    color: T.textLight,
    textAlign: 'center',
  },

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
  permIcon: {
    fontSize: 40,
    marginBottom: 16,
  },
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
  permButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },

  /* Transaction list */
  list: {
    padding: 20,
    paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: T.text,
    marginBottom: 12,
  },
  emptyCard: {
    backgroundColor: T.card,
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 2,
  },
  emptyIcon: {
    fontSize: 36,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 14,
    color: T.textMid,
    textAlign: 'center',
    lineHeight: 22,
  },
  txCard: {
    backgroundColor: T.card,
    borderRadius: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  txCardBorder: {
    borderTopWidth: 1,
    borderTopColor: T.border,
  },
  txIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: T.blueLight,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  txIconText: {
    fontSize: 18,
  },
  txInfo: {
    flex: 1,
    minWidth: 0,
  },
  txTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: T.text,
  },
  txMeta: {
    fontSize: 11,
    color: T.textLight,
    marginTop: 2,
  },
  txRight: {
    maxWidth: 120,
    alignItems: 'flex-end',
  },
  txText: {
    fontSize: 12,
    color: T.textMid,
    textAlign: 'right',
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
  navIcon: {
    fontSize: 20,
    opacity: 0.4,
  },
  navIconActive: {
    opacity: 1,
  },
  navLabel: {
    fontSize: 10,
    color: T.textLight,
    fontWeight: '400',
  },
  navLabelActive: {
    color: T.blue,
    fontWeight: '600',
  },
});
