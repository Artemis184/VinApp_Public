import axios from 'axios';
import { enviarAlMaestro, pingNodoViaMaestro } from './maestro.service';

export type NodeCommunicationMethod = 'rf' | 'wifi';

export interface NodeCommunicationTarget {
  id: number;
  code: string;
  communication_method?: 'rf' | 'wifi' | 'auto' | null;
  ip_address?: string | null;
  rf_slot?: number | null;
  rf_address?: string | null;
}

interface SendNodeCommandOptions {
  method?: NodeCommunicationMethod;
  wifiEndpoint?: string;
}

interface SendNodeCommandResult {
  success: boolean;
  method: NodeCommunicationMethod;
  message?: string;
}

const NODE_COMM_MODE = (process.env.NODE_COMM_MODE || 'rf').toLowerCase();
const NODE_WIFI_ENDPOINT = process.env.NODE_WIFI_ENDPOINT || '';
const NODE_WIFI_SHARED_TOKEN = parseToken(process.env.NODE_WIFI_SHARED_TOKEN || '0xCHANGE_ME');

const CMD_OFF = 0;
const CMD_ON = 1;
const CMD_PING = 2;

function parseToken(raw: string): number {
  const normalized = raw.trim().toLowerCase();
  const parsed = normalized.startsWith('0x')
    ? Number.parseInt(normalized, 16)
    : Number.parseInt(normalized, 10);

  if (Number.isNaN(parsed)) {
    return 0;
  }

  return parsed >>> 0;
}

function looksLikeWifiAddress(value: string): boolean {
  const trimmed = value.trim();

  if (!trimmed) return false;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return true;

  // IPv4 simple: 192.168.18.2 o con puerto/ruta
  if (/^(\d{1,3}\.){3}\d{1,3}(?::\d+)?(?:\/.*)?$/.test(trimmed)) {
    return true;
  }

  // Hostname con dominio (requiere punto), opcional puerto/ruta
  return /^[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+(?::\d+)?(?:\/.*)?$/.test(trimmed);
}

function resolveNodeCommunicationMethod(
  node: NodeCommunicationTarget,
  requestedMethod?: NodeCommunicationMethod
): NodeCommunicationMethod {
  // 1. Solicitud explícita tiene mayor prioridad
  if (requestedMethod) {
    return requestedMethod;
  }

  // 2. Si el nodo tiene method explícito (no es auto), úsalo
  if (node.communication_method && node.communication_method !== 'auto') {
    return node.communication_method;
  }

  // 3. NODE_COMM_MODE global (si no es auto)
  if (NODE_COMM_MODE === 'wifi') {
    return 'wifi';
  }

  // 4. Modo auto: detectar por IP
  if (NODE_COMM_MODE === 'auto' || node.communication_method === 'auto') {
    if (node.ip_address && looksLikeWifiAddress(node.ip_address)) {
      return 'wifi';
    }

    if (node.rf_address && looksLikeWifiAddress(node.rf_address)) {
      return 'wifi';
    }
  }

  return 'rf';
}

function normalizeWifiEndpoint(rawEndpoint: string): string {
  const trimmed = rawEndpoint.trim();

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed.endsWith('/cmd') ? trimmed : `${trimmed.replace(/\/$/, '')}/cmd`;
  }

  return `http://${trimmed.replace(/\/$/, '')}/cmd`;
}

function getWifiEndpoint(node: NodeCommunicationTarget, overrideEndpoint?: string): string {
  const candidate = overrideEndpoint || node.ip_address || node.rf_address || NODE_WIFI_ENDPOINT;

  if (!candidate) {
    throw new Error('No hay endpoint WiFi configurado para el nodo');
  }

  return normalizeWifiEndpoint(candidate);
}

function parseWifiAck(responseData: any): boolean {
  if (responseData?.status === undefined) {
    return true;
  }

  return responseData.status === 1 || responseData.status === true;
}

async function sendWifiCommand(
  node: NodeCommunicationTarget,
  command: number,
  overrideEndpoint?: string
): Promise<boolean> {
  const endpoint = getWifiEndpoint(node, overrideEndpoint);

  const payload = {
    nodo: node.rf_slot ?? node.id,
    code: node.code,
    comando: command,
    token: NODE_WIFI_SHARED_TOKEN,
  };

  const response = await axios.post(endpoint, payload, {
    timeout: 5000,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  return response.status >= 200 && response.status < 300 && parseWifiAck(response.data);
}

export function getNodeCommunicationMethod(
  node: NodeCommunicationTarget,
  requestedMethod?: NodeCommunicationMethod
): NodeCommunicationMethod {
  return resolveNodeCommunicationMethod(node, requestedMethod);
}

export async function sendNodeCommand(
  node: NodeCommunicationTarget,
  state: boolean,
  options?: SendNodeCommandOptions
): Promise<SendNodeCommandResult> {
  const method = resolveNodeCommunicationMethod(node, options?.method);

  try {
    if (method === 'wifi') {
      const command = state ? CMD_ON : CMD_OFF;
      const ok = await sendWifiCommand(node, command, options?.wifiEndpoint);

      return {
        success: ok,
        method,
        message: ok ? undefined : 'Nodo WiFi respondió con estado inválido',
      };
    }

    const rfResult = await enviarAlMaestro(node.id, node.code, state);

    return {
      success: rfResult.success,
      method,
      message: rfResult.message,
    };
  } catch (error: any) {
    return {
      success: false,
      method,
      message: error.message,
    };
  }
}

export async function pingNodeByCommunication(
  node: NodeCommunicationTarget,
  options?: SendNodeCommandOptions
): Promise<boolean> {
  const method = resolveNodeCommunicationMethod(node, options?.method);

  if (method === 'wifi') {
    try {
      return await sendWifiCommand(node, CMD_PING, options?.wifiEndpoint);
    } catch {
      return false;
    }
  }

  return pingNodoViaMaestro(node.code);
}
