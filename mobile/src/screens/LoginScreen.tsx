import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { RootStackParamList } from '../navigation/AppNavigator';

const T = {
  blue:      '#4A6FA5',
  blueLight: '#EEF2F9',
  text:      '#1A1D23',
  textMid:   '#5A6070',
  textLight: '#9AA0AD',
  border:    '#E8EAF0',
  red:       '#D94F4F',
  redLight:  '#FDF0F0',
};

const API_URL = 'http://10.176.200.225:8080';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [focused, setFocused]   = useState<'email' | 'password' | null>(null);
  const [showPass, setShowPass] = useState(false);

  async function handleLogin() {
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Credenciales incorrectas.');
        return;
      }
      await AsyncStorage.setItem('token', data.token);
      navigation.replace('Dashboard');
    } catch {
      setError('No se pudo conectar con el servidor.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo */}
        <View style={styles.logoArea}>
          <View style={styles.logoMark}>
            <Text style={styles.logoLetter}>F</Text>
          </View>
          <Text style={styles.brand}>FinWard</Text>
          <Text style={styles.tagline}>Tus finanzas, siempre bajo control</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {/* Email */}
          <View>
            <Text style={styles.label}>CORREO ELECTRÓNICO</Text>
            <View style={[styles.inputRow, focused === 'email' && styles.inputRowFocused]}>
              <Text style={[styles.inputIcon, focused === 'email' && styles.inputIconActive]}>✉</Text>
              <TextInput
                style={styles.inputText}
                placeholder="usuario@email.com"
                placeholderTextColor={T.textLight}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                value={email}
                onChangeText={setEmail}
                onFocus={() => setFocused('email')}
                onBlur={() => setFocused(null)}
              />
            </View>
          </View>

          {/* Password */}
          <View>
            <Text style={styles.label}>CONTRASEÑA</Text>
            <View style={[styles.inputRow, focused === 'password' && styles.inputRowFocused]}>
              <Text style={[styles.inputIcon, focused === 'password' && styles.inputIconActive]}>🔒</Text>
              <TextInput
                style={[styles.inputText, { flex: 1 }]}
                placeholder="••••••••"
                placeholderTextColor={T.textLight}
                secureTextEntry={!showPass}
                autoComplete="current-password"
                value={password}
                onChangeText={setPassword}
                onFocus={() => setFocused('password')}
                onBlur={() => setFocused(null)}
              />
              <TouchableOpacity onPress={() => setShowPass(v => !v)} hitSlop={8}>
                <Text style={styles.inputIcon}>{showPass ? '🙈' : '👁'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity style={styles.forgotRow} activeOpacity={0.7}>
            <Text style={styles.forgotText}>¿Olvidaste tu contraseña?</Text>
          </TouchableOpacity>

          {error !== '' && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Ingresar</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.spacer} />

        <View style={styles.footer}>
          <Text style={styles.footerText}>¿No tienes cuenta? </Text>
          <TouchableOpacity activeOpacity={0.7}>
            <Text style={styles.footerLink}>Regístrate</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 28,
  },

  /* Logo area */
  logoArea: {
    alignItems: 'center',
    paddingTop: 72,
    paddingBottom: 48,
  },
  logoMark: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: T.blue,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    shadowColor: T.blue,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.27,
    shadowRadius: 12,
    elevation: 8,
  },
  logoLetter: {
    fontSize: 26,
    fontWeight: '700',
    color: '#fff',
  },
  brand: {
    fontSize: 28,
    fontWeight: '700',
    color: T.text,
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 14,
    color: T.textMid,
    marginTop: 6,
  },

  /* Form */
  form: {
    gap: 14,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: T.textMid,
    letterSpacing: 0.3,
    marginBottom: 6,
  },
  inputRow: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: T.border,
    backgroundColor: '#FAFBFC',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 10,
  },
  inputRowFocused: {
    borderColor: T.blue,
    backgroundColor: T.blueLight,
  },
  inputIcon: {
    fontSize: 16,
    color: T.textLight,
  },
  inputIconActive: {
    color: T.blue,
  },
  inputText: {
    flex: 1,
    fontSize: 15,
    color: T.text,
    paddingVertical: 0,
  },
  forgotRow: {
    alignItems: 'flex-end',
    marginTop: -4,
  },
  forgotText: {
    fontSize: 13,
    color: T.blue,
    fontWeight: '500',
  },
  errorBox: {
    backgroundColor: T.redLight,
    borderRadius: 10,
    padding: 12,
  },
  errorText: {
    color: T.red,
    fontSize: 13,
  },
  button: {
    height: 54,
    borderRadius: 16,
    backgroundColor: T.blue,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: T.blue,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.27,
    shadowRadius: 10,
    elevation: 6,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.2,
  },

  /* Footer */
  spacer: { flex: 1 },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 36,
    paddingTop: 20,
  },
  footerText: {
    fontSize: 14,
    color: T.textMid,
  },
  footerLink: {
    fontSize: 14,
    color: T.blue,
    fontWeight: '600',
  },
});
