import { Injectable, inject } from '@angular/core';
import { Storage } from '@ionic/storage-angular';
import { AUTH_STORAGE } from 'src/constants/app.constants';

/**
 * Servicio de almacenamiento con cifrado AES-GCM.
 * Utiliza Ionic Storage como backend principal y localStorage como fallback.
 */
@Injectable({
  providedIn: 'root',
})
export class SecureStorageService {
  private _storage: Storage | null = null;
  private isInitialized = false;
  private storage = inject(Storage);

  constructor() {
    this.init();
  }

  /**
   * Inicializa la instancia de Ionic Storage.
   */
  private async init(): Promise<void> {
    try {
      this._storage = await this.storage.create();
    } catch (error) {
      console.error(
        'Error inicializando storage, se usará fallback local:',
        error,
      );
      this._storage = null;
    } finally {
      this.isInitialized = true;
    }
  }

  /**
   * Espera hasta que el servicio esté inicializado.
   */
  private async waitForInitialization(): Promise<void> {
    let attempts = 0;

    while (!this.isInitialized && attempts < 50) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      attempts++;
    }

    if (!this.isInitialized) {
      throw new Error('Storage no pudo inicializarse correctamente');
    }
  }

  /**
   * Guarda un valor cifrado.
   */
  async setItem(key: string, value: any): Promise<void> {
    await this.waitForInitialization();

    try {
      const payload = JSON.stringify(value);
      const encrypted = await this.encryptString(payload);

      if (this._storage) {
        await this._storage.set(key, encrypted);
      } else {
        localStorage.setItem(key, encrypted);
      }
    } catch (error) {
      console.error(`Error guardando clave ${key}:`, error);
      throw error;
    }
  }

  /**
   * Obtiene y descifra un valor almacenado.
   */
  async getItem(key: string): Promise<any> {
    await this.waitForInitialization();

    try {
      const stored = this._storage
        ? await this._storage.get(key)
        : localStorage.getItem(key);

      if (!stored) return null;

      try {
        const decrypted = await this.decryptString(stored);
        return JSON.parse(decrypted);
      } catch {
        // Compatibilidad con datos antiguos sin cifrar
        try {
          return JSON.parse(stored);
        } catch {
          return stored;
        }
      }
    } catch (error) {
      console.error(`Error leyendo clave ${key}:`, error);
      return null;
    }
  }

  /**
   * Elimina una clave específica.
   */
  async removeItem(key: string): Promise<void> {
    await this.waitForInitialization();

    try {
      if (this._storage) {
        await this._storage.remove(key);
      } else {
        localStorage.removeItem(key);
      }
    } catch (error) {
      console.error(`Error eliminando clave ${key}:`, error);
      throw error;
    }
  }

  /**
   * Limpia completamente el almacenamiento.
   */
  async clear(): Promise<void> {
    await this.waitForInitialization();

    try {
      if (this._storage) {
        await this._storage.clear();
      } else {
        localStorage.clear();
      }

      localStorage.removeItem(AUTH_STORAGE.ENC_KEY_JWK);
    } catch (error) {
      console.error('Error limpiando storage:', error);
      throw error;
    }
  }

  /**
   * Verifica si una clave existe.
   */
  async hasKey(key: string): Promise<boolean> {
    try {
      const value = await this.getItem(key);
      return value !== null && value !== undefined;
    } catch {
      return false;
    }
  }

  /**
   * Retorna todas las claves almacenadas.
   */
  async keys(): Promise<string[]> {
    await this.waitForInitialization();

    try {
      return this._storage
        ? await this._storage.keys()
        : Object.keys(localStorage);
    } catch (error) {
      console.error('Error obteniendo claves:', error);
      return [];
    }
  }

  /* =====================
     Cifrado AES-GCM
  ====================== */

  /**
   * Obtiene o genera la clave criptográfica persistente.
   */
  private async getCryptoKey(): Promise<CryptoKey> {
    try {
      const jwkRaw = localStorage.getItem(AUTH_STORAGE.ENC_KEY_JWK);

      if (jwkRaw) {
        const jwk = JSON.parse(jwkRaw);
        return await crypto.subtle.importKey(
          'jwk',
          jwk,
          { name: 'AES-GCM' },
          true,
          ['encrypt', 'decrypt'],
        );
      }
    } catch {
      // Si falla la importación se generará una nueva clave
    }

    const key = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt'],
    );

    const jwk = await crypto.subtle.exportKey('jwk', key);
    localStorage.setItem(AUTH_STORAGE.ENC_KEY_JWK, JSON.stringify(jwk));

    return key;
  }

  /**
   * Cifra una cadena utilizando AES-GCM.
   */
  private async encryptString(plain: string): Promise<string> {
    const encoder = new TextEncoder();
    const key = await this.getCryptoKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encoder.encode(plain),
    );

    const ivStr = this.arrayBufferToBase64(iv.buffer);
    const dataStr = this.arrayBufferToBase64(encrypted);

    return `${ivStr}:${dataStr}`;
  }

  /**
   * Descifra una cadena previamente cifrada.
   */
  private async decryptString(data: string): Promise<string> {
    const [ivB64, ctB64] = data.split(':');
    if (!ivB64 || !ctB64) {
      throw new Error('Formato de datos cifrados inválido');
    }

    const iv = new Uint8Array(this.base64ToArrayBuffer(ivB64));
    const ciphertext = this.base64ToArrayBuffer(ctB64);
    const key = await this.getCryptoKey();

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext,
    );

    return new TextDecoder().decode(decrypted);
  }

  /**
   * Convierte un array buffer a base64.
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);

    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }

    return btoa(binary);
  }

  /**
   * Convierte base64 a array buffer.
   */
  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    return bytes.buffer;
  }
}
