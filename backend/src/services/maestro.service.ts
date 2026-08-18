import axios from 'axios';

const MAESTRO_IP = process.env.MAESTRO_IP || '192.168.4.30';
const MAESTRO_PORT = process.env.MAESTRO_PORT || 80;
const MAESTRO_BASE_URL = `http://${MAESTRO_IP}:${MAESTRO_PORT}`;

interface MaestroResponse {
  success: boolean;
  nodeId?: number;
  code?: string;
  comando?: 'ON' | 'OFF';
  message?: string;
}

/**
 * Envía comando al maestro RF24
 * Traduce: Código único → Número RF → HTTP → RF24
 *
 * @param nodeId - ID del nodo en BD
 * @param code - Código único del nodo (ej: ALM-JC-0001-L1)
 * @param state - true = ON, false = OFF
 */
export async function enviarAlMaestro(
  nodeId: number,
  code: string,
  state: boolean
): Promise<MaestroResponse> {
  try {
    const comando = state ? 'on' : 'off';
    const encodedCode = encodeURIComponent(code);
    const url = `${MAESTRO_BASE_URL}/${comando}?code=${encodedCode}`;

    console.log(`\n📤 MAESTRO: Enviando comando`);
    console.log(`   ↳ Código: ${code}`);
    console.log(`   ↳ Node ID (DB): ${nodeId}`);
    console.log(`   ↳ Comando: ${comando.toUpperCase()}`);
    console.log(`   ↳ URL: ${url}`);

    const response = await axios.get(url, {
      timeout: 5000,
    });

    console.log(`✅ MAESTRO: Respuesta ${response.status}`);

    return {
      success: response.status === 200,
      nodeId,
      code,
      comando: state ? 'ON' : 'OFF',
    };
  } catch (error: any) {
    console.error(`\n❌ MAESTRO ERROR:`);
    console.error(`   ↳ Código: ${code}`);
    console.error(`   ↳ ${error.message}`);

    return {
      success: false,
      code,
      message: error.message,
    };
  }
}

/**
 * Verifica conectividad con maestro
 */
export async function verificarMaestroDisponible(): Promise<boolean> {
  try {
    const response = await axios.get(`${MAESTRO_BASE_URL}/status`, {
      timeout: 3000,
    });
    return response.status === 200;
  } catch (error) {
    console.warn(`⚠️ Maestro no disponible: ${MAESTRO_BASE_URL}`);
    console.log(error);
    return false;
  }
}

/**
 * Ping a un nodo vía maestro RF24
 */
export async function pingNodoViaMaestro(code: string): Promise<boolean> {
  try {
    const encodedCode = encodeURIComponent(code);
    const url = `${MAESTRO_BASE_URL}/ping?code=${encodedCode}`;
    const response = await axios.get(url, { timeout: 3000 });

    return response.data?.exito === true;
  } catch {
    return false;
  }
}
