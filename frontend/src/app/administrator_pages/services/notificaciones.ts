import { Injectable } from '@angular/core';

export interface Notificacion {
  tipo: 'DATOS_MODIFICADOS' | 'ESTADO_CAMBIADO' | 'ALARMAS_MODIFICADAS';
  usuarioId: string;
  mensaje: string;
  fecha: Date;
  datosModificados?: any;
}

@Injectable({
  providedIn: 'root',
})
export class Notificaciones {
  private notificacionesPendientes: Notificacion[] = [];

  constructor() {}

  async notificarUsuario(notificacion: Notificacion): Promise<boolean> {
    console.log('📧 Notificando al usuario:', notificacion);

    this.notificacionesPendientes.push(notificacion);

    await new Promise((resolve) => setTimeout(resolve, 500));

    return true;
  }

  async notificarCambioDatos(
    usuarioId: string,
    datosAnteriores: any,
    datosNuevos: any,
  ): Promise<boolean> {
    const cambios: string[] = [];

    // Detectar qué cambió
    for (const key in datosNuevos) {
      if (datosAnteriores[key] !== datosNuevos[key]) {
        cambios.push(key);
      }
    }

    if (cambios.length === 0) return true;

    const notificacion: Notificacion = {
      tipo: 'DATOS_MODIFICADOS',
      usuarioId,
      mensaje: `Se han modificado tus datos: ${cambios.join(', ')}`,
      fecha: new Date(),
      datosModificados: {
        antes: datosAnteriores,
        despues: datosNuevos,
        campos: cambios,
      },
    };

    return this.notificarUsuario(notificacion);
  }

  async notificarCambioEstado(
    usuarioId: string,
    estadoAnterior: string,
    estadoNuevo: string,
  ): Promise<boolean> {
    if (estadoAnterior === estadoNuevo) return true;

    const notificacion: Notificacion = {
      tipo: 'ESTADO_CAMBIADO',
      usuarioId,
      mensaje: `Tu cuenta ha sido ${estadoNuevo === 'HABILITADO' ? 'habilitada' : 'suspendida'}`,
      fecha: new Date(),
      datosModificados: {
        estadoAnterior,
        estadoNuevo,
      },
    };

    return this.notificarUsuario(notificacion);
  }

  async notificarCambioAlarmas(
    usuarioId: string,
    alarmasAnteriores: any[],
    alarmasNuevas: any[],
  ): Promise<boolean> {
    const cambios = this.detectarCambiosAlarmas(
      alarmasAnteriores,
      alarmasNuevas,
    );

    if (cambios.length === 0) return true;

    const notificacion: Notificacion = {
      tipo: 'ALARMAS_MODIFICADAS',
      usuarioId,
      mensaje: `Se han modificado tus alarmas asignadas`,
      fecha: new Date(),
      datosModificados: {
        cambios,
      },
    };

    return this.notificarUsuario(notificacion);
  }

  private detectarCambiosAlarmas(anteriores: any[], nuevas: any[]): string[] {
    const cambios: string[] = [];

    for (const alarma of nuevas) {
      const anterior = anteriores.find((a) => a.id === alarma.id);
      if (anterior && anterior.activa !== alarma.activa) {
        cambios.push(
          `${alarma.nombre}: ${alarma.activa ? 'activada' : 'desactivada'}`,
        );
      }
    }

    return cambios;
  }

  getNotificacionesPendientes(): Notificacion[] {
    return [...this.notificacionesPendientes];
  }

  limpiarNotificaciones() {
    this.notificacionesPendientes = [];
  }
}
