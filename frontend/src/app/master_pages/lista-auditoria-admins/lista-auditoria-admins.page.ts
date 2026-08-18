import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpParams } from '@angular/common/http';
import {
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonIcon,
  IonList,
  IonFab,
  IonFabButton,
  IonFabList,
  IonModal,
  IonDatetime,
  IonRadioGroup,
  IonItem,
  IonLabel,
  IonRadio,
  IonText,
} from '@ionic/angular/standalone';
import { AdminBackHeaderComponent } from 'src/app/shared/admin-back-header/admin-back-header.component';

import {
  ACCION_TRADUCCION,
  META_KEY_TRADUCCION,
  GREEN_STATUS_ACTIONS,
  RED_STATUS_ACTIONS,
  VALORES_TRADUCCION,
  FALLBACK_TRADUCCION,
} from 'src/constants/app.constants';

import {
  AdminFiltro,
  AlarmaFiltro,
  AuditoriaAdmin,
} from 'src/app/master_pages/interfaces/auditoria-admins';

import { AuditService } from 'src/app/services/audit.service';

@Component({
  standalone: true,
  selector: 'app-lista-auditoria-admins',
  templateUrl: './lista-auditoria-admins.page.html',
  styleUrls: ['./lista-auditoria-admins.page.scss'],
  imports: [
    CommonModule,
    FormsModule,
    IonContent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonIcon,
    IonList,
    IonFab,
    IonFabButton,
    IonFabList,
    IonModal,
    IonDatetime,
    IonRadioGroup,
    IonItem,
    IonLabel,
    IonRadio,
    IonText,
    AdminBackHeaderComponent,
  ],
})
export class ListaAuditoriaAdminsPage implements OnInit {
  modalFechasOpen = false;
  modalAlarmaOpen = false;
  modalAdminOpen = false;
  modalDetalleOpen = false;

  fechaInicioISO: string | null = null;
  fechaFinISO: string | null = null;
  alarmaSeleccionadaId: number | null = null;
  adminSeleccionadoId: string | null = null;

  itemSeleccionado: AuditoriaAdmin | null = null;

  adminsFiltrables: AdminFiltro[] = [];
  alarmasFiltrables: AlarmaFiltro[] = [];

  filtrosActivos = false;

  auditoriaAll: AuditoriaAdmin[] = [];
  auditoriaFiltrada: AuditoriaAdmin[] = [];

  modoHistorialAlarmas = false;

  constructor(private auditService: AuditService) {}

  ngOnInit() {
    this.cargarAuditoria();
    this.cargarListaMaestraAlarmas();
  }

  cargarAuditoria() {
    let httpParams = new HttpParams();

    // 1. Configuración de parámetros de filtrado
    if (
      !this.modoHistorialAlarmas &&
      this.adminSeleccionadoId &&
      this.adminSeleccionadoId.length > 20
    ) {
      httpParams = httpParams.set('adminId', this.adminSeleccionadoId);
    }

    if (this.alarmaSeleccionadaId !== null) {
      httpParams = httpParams.set(
        'nodeId',
        this.alarmaSeleccionadaId.toString(),
      );
      this.modoHistorialAlarmas = true;
    }

    // AJUSTE AQUÍ: Forzamos el formato YYYY-MM-DD antes de enviarlo

    if (this.fechaInicioISO) {
      // Tomamos solo la parte YYYY-MM-DD sin convertir a ISO (que cambia la zona horaria)
      const fechaLimpiaInicio = this.fechaInicioISO.split('T')[0];
      httpParams = httpParams.set('from', fechaLimpiaInicio);
    }

    if (this.fechaFinISO) {
      const fechaLimpiaFin = this.fechaFinISO.split('T')[0];
      httpParams = httpParams.set('to', fechaLimpiaFin);
    }

    this.filtrosActivos =
      httpParams.keys().length > 0 || this.modoHistorialAlarmas;

    // --- LÓGICA DE DECISIÓN ---
    if (this.modoHistorialAlarmas) {
      /**
       * IMPORTANTE: Usamos 'getFiltered' en lugar de 'getSoloAlarmas' para el historial.
       * 'getSoloAlarmas' en tu backend está limitado a 1 resultado por nodo (take: 1).
       * 'getFiltered' trae la lista completa de audit_admin_actions filtrada por nodeId.
       */
      this.auditService.getFiltered(httpParams).subscribe({
        next: (res: any) => {
          const rawData = res.data || [];

          this.auditoriaAll = rawData
            .map((item: any) => {
              // Detectamos el tipo de acción según el esquema (audit_admin_actions tiene action_type)
              const esAccionAdmin = !!item.action_type;

              return {
                id: Number(item.id || 1),
                // Mapeo según Enums de tu Prisma
                accion: esAccionAdmin
                  ? item.action_type
                  : item.estado_texto === 'ACTIVADA'
                    ? 'ALARM_ON'
                    : 'ALARM_OFF',
                accionTraducida: esAccionAdmin
                  ? item.action_type.replace(/_/g, ' ')
                  : item.estado_texto || 'Cambio de Estado',

                // Datos del Usuario/Admin (Relaciones de Prisma)
                adminId: item.admin_id || item.user_id || 'SYSTEM',
                adminNombre:
                  item.users_audit_admin_actions_admin_idTousers?.full_name ||
                  item.usuario ||
                  item.full_name ||
                  'Admin',
                adminCorreo:
                  item.users_audit_admin_actions_admin_idTousers?.email ||
                  item.correo ||
                  item.email ||
                  'Registro',

                // Datos del Nodo (Alarma)
                alarmaId: item.node_id || 0,
                alarmaNombre:
                  item.nodes?.name || item.alarma_nombre || 'Alarma',
                alarmaCodigo: item.nodes?.code || item.codigo || 'S/N',
                alarmaUbicacion:
                  item.nodes?.location || item.direccion || 'N/A',

                // Fecha: Usamos action_timestamp que es el campo de tus tablas de auditoría
                fechaISO:
                  item.action_timestamp || item.fecha_raw || item.created_at,

                metadata: item.metadata || item.new_value || null,
                resumenDinamico: esAccionAdmin
                  ? `Acción administrativa: ${item.action_type} realizada por ${item.users_audit_admin_actions_admin_idTousers?.full_name || 'Admin'}`
                  : `La unidad fue ${item.estado_texto?.toLowerCase() || 'actualizada'}`,
              };
            })
            .sort(
              (a: any, b: any) =>
                new Date(b.fechaISO).getTime() - new Date(a.fechaISO).getTime(),
            );

          this.finalizarCarga();
        },
        error: (err) => console.error('Error en historial de alarma', err),
      });
    } else {
      // --- MODO ADMINS: Lista maestra (Tu lógica original intacta) ---
      const request$ = this.filtrosActivos
        ? this.auditService.getFiltered(httpParams)
        : this.auditService.getMasterAdminAuditList();

      request$.subscribe({
        next: (response: any) => {
          const rawData = response.data || [];
          let mappedData: any[] = [];

          if (!this.filtrosActivos) {
            rawData.forEach((user: any) => {
              const acciones =
                user.audit_admin_actions_audit_admin_actions_admin_idTousers;
              if (acciones && acciones.length > 0) {
                acciones.forEach((act: any) =>
                  mappedData.push(this.mapearItemUnico(user, act)),
                );
              } else {
                mappedData.push(this.crearItemSinActividad(user));
              }
            });
          } else {
            mappedData = rawData.map((item: any) => {
              const user = item.users_audit_admin_actions_admin_idTousers || {
                id: item.admin_id,
                full_name: item.usuario || 'Admin',
              };
              return this.mapearItemUnico(user, item);
            });
          }

          this.auditoriaAll = mappedData.sort((a: any, b: any) => {
            const aTieneActividad = a.id > 0 && a.accion !== 'SIN_ACTIVIDAD';
            const bTieneActividad = b.id > 0 && b.accion !== 'SIN_ACTIVIDAD';
            if (aTieneActividad && !bTieneActividad) return -1;
            if (!aTieneActividad && bTieneActividad) return 1;
            return (
              new Date(b.fechaISO).getTime() - new Date(a.fechaISO).getTime()
            );
          });

          this.finalizarCarga();
        },
        error: (err) =>
          console.error('Error cargando auditoría de admins', err),
      });
    }
  }

  // Métodos de apoyo (Asegúrate de que existan en tu clase)
  private finalizarCarga() {
    this.generarFiltrosDinamicos();
    this.auditoriaFiltrada = this.procesarDatosVisuales(this.auditoriaAll);
  }

  private crearItemSinActividad(user: any) {
    return {
      id: 0,
      adminId: user.id,
      adminNombre: user.full_name || 'Admin',
      adminCorreo: user.email,
      accion: 'SIN_ACTIVIDAD',
      fechaISO: user.created_at,
      metadata: null,
      alarmaId: null,
      alarmaNombre: 'Sin movimientos',
      alarmaCodigo: 'N/A',
      alarmaUbicacion: 'N/A',
    };
  }

  private mapearItemUnico(user: any, act: any) {
    // CORRECCIÓN 1: Según tu Prisma, la relación es 'nodes'
    const nodo = act.nodes;
    const nodoDesdePayload =
      act.new_value?.nodes ||
      act.old_value?.nodes ||
      act.new_value?.node ||
      act.old_value?.node ||
      act.new_value?.name ||
      act.old_value?.name ||
      act.new_value?.node_name ||
      act.old_value?.node_name ||
      null;
    const codigoDesdePayload =
      act.new_value?.code || act.old_value?.code || act.new_value?.node_code || act.old_value?.node_code || null;

    let detalleManual = '';
    // Expandimos la lista de acciones que generan este detalle rápido
    const accionesNodo = [
      'SUSPEND_NODE',
      'ENABLE_NODE',
      'CREATE_NODE',
      'ASSIGN_NODE',
      'UPDATE_NODE_DATA',
    ];

    if (accionesNodo.includes(act.action_type)) {
      const estados: any = {
        SUSPEND_NODE: 'SUSPENDIDO',
        ENABLE_NODE: 'HABILITADO',
        CREATE_NODE: 'CREADO',
        ASSIGN_NODE: 'ASIGNADO',
        UPDATE_NODE_DATA: 'ACTUALIZADO',
      };

      const estado = estados[act.action_type] || 'PROCESADO';

      // Intentamos sacar nombre/código del objeto nodo vinculado por Prisma
      const nombreNodo =
        nodo?.name || nodoDesdePayload || 'Nodo #' + (act.node_id || 'ID Desconocido');
      const codigoNodo = nodo?.code || codigoDesdePayload || 'S/N';

      detalleManual = `${estado}: ${nombreNodo} (Código: ${codigoNodo})`;
    }

    return {
      id: Number(act.id),
      adminId: user.id,
      adminNombre: user.full_name || FALLBACK_TRADUCCION.ADMIN_DEMO,
      adminCorreo: user.email,
      accion: act.action_type,
      detalleVisualRapido: detalleManual,
      fechaISO: act.action_timestamp,
      metadata: {
        oldValue: act.old_value,
        newValue: act.new_value,
        affectedUser: act.users_audit_admin_actions_affected_user_idTousers,
      },
      alarmaId: act.node_id || null,
      alarmaNombre: nodo?.name || nodoDesdePayload || FALLBACK_TRADUCCION.NOMBRE,
      alarmaCodigo: nodo?.code || codigoDesdePayload || FALLBACK_TRADUCCION.CODIGO,
      // CORRECCIÓN 2: En tu Prisma el campo es 'location'
      alarmaUbicacion: nodo?.location || FALLBACK_TRADUCCION.UBICACION,
    };
  }

  cargarSoloNodosExistentes() {
    // Llama a un nuevo método en tu service que traiga los nodos base
    this.auditService.getNodes().subscribe({
      next: (res: any) => {
        const baseNodes = res.data || [];
        this.auditoriaAll = baseNodes.map((n: any) => ({
          ...n,
          accion: 'SIN_ACTIVIDAD',
          accionTraducida: 'DISPONIBLE',
          adminNombre: 'N/A',
          resumenDinamico:
            'Esta alarma no presenta registros de uso recientes.',
          fechaISO: new Date().toISOString(),
        }));
        this.auditoriaFiltrada = this.procesarDatosVisuales(this.auditoriaAll);
      },
    });
  }

  generarFiltrosDinamicos() {
    // 1. Usamos un Map para los administradores (siguen siendo dinámicos)
    const mapAdmins = new Map<string, AdminFiltro>();

    this.auditoriaAll.forEach((item) => {
      // Filtramos solo IDs que sean UUIDs reales (evita "SYSTEM" o "USER_ACTION")
      if (
        item.adminId &&
        item.adminId.length > 20 &&
        !mapAdmins.has(item.adminId)
      ) {
        mapAdmins.set(item.adminId, {
          id: item.adminId,
          nombre: item.adminNombre,
          correo: item.adminCorreo,
        });
      }
    });

    this.adminsFiltrables = Array.from(mapAdmins.values());
  }

  cargarListaMaestraAlarmas() {
    this.auditService.getNodes().subscribe({
      next: (res: any) => {
        const nodosBase = res.data || [];
        this.alarmasFiltrables = nodosBase.map((n: any) => ({
          id: n.id,
          nombre: n.name || `Alarma ${n.code || n.id}`,
        }));
      },
      error: (err) =>
        console.error('Error cargando lista maestra de alarmas', err),
    });
  }

  cargarHistorialSoloAlarmas() {
    let params = new HttpParams();

    // 1. Agregamos filtros si existen en la interfaz del usuario
    if (this.alarmaSeleccionadaId) {
      params = params.set('nodeId', this.alarmaSeleccionadaId.toString());
    }
    if (this.fechaInicioISO) {
      params = params.set('from', this.fechaInicioISO.split('T')[0]);
    }
    if (this.fechaFinISO) {
      params = params.set('to', this.fechaFinISO.split('T')[0]);
    }

    // 2. Llamamos al servicio (ahora sí con el nombre correcto)
    this.auditService.getSoloAlarmas(params).subscribe({
      next: (res: any) => {
        // res.data es el array que viene del backend
        const rawData = Array.isArray(res.data) ? res.data : [];

        this.auditoriaAll = rawData.map((item: any) => {
          // Mapeamos los campos del backend (titulo, usuario, direccion)
          // a los campos de tu interfaz AuditoriaAdmin
          return {
            id: Number(item.id),
            accion: item.estado_texto === 'ACTIVADA' ? 'ALARM_ON' : 'ALARM_OFF',
            accionTraducida: item.estado_texto,
            adminId: 'USER_LOG',
            adminNombre: item.usuario, // Mapeado de 'usuario' en el controlador
            adminCorreo: 'audit@sistema.com',
            alarmaId: this.alarmaSeleccionadaId || 0,
            alarmaNombre: item.titulo, // Mapeado de 'titulo'
            alarmaCodigo: item.titulo.split('#')[1]?.trim() || 'S/N',
            alarmaUbicacion: item.direccion, // Mapeado de 'direccion'
            fechaISO: item.fecha_raw,
            metadata: null,
            resumenDinamico: `Unidad ${item.estado_texto.toLowerCase()} por ${item.usuario || 'el Sistema'}`,
            fechaTexto: new Date(item.fecha_raw).toLocaleString(),
          };
        });

        // 3. Procesamos los datos visuales (colores de los badges, etc.)
        this.auditoriaFiltrada = this.procesarDatosVisuales(this.auditoriaAll);
      },
      error: (err) => console.error('Error cargando alarmas:', err),
    });
  }

  private procesarDatosVisuales(items: AuditoriaAdmin[]): AuditoriaAdmin[] {
    return items.map((item) => {
      let resumenCambios = '';

      // Identificamos si es una acción simple de nodo (donde el título ya lo dice todo)
      const esAccionSimpleNodo = ['SUSPEND_NODE', 'ENABLE_NODE'].includes(
        item.accion,
      );

      // 1. GENERACIÓN DEL RESUMEN DINÁMICO
      // Solo generamos el resumen si NO es una acción simple de nodo
      if (
        !esAccionSimpleNodo &&
        item.metadata?.newValue &&
        typeof item.metadata.newValue === 'object'
      ) {
        const llaves = Object.keys(item.metadata.newValue).filter(
          (k) =>
            ![
              'name',
              'code',
              'description',
              'id',
              'node_id',
              'is_enabled',
              'is_active',
            ].includes(k),
        );

        if (llaves.length > 0) {
          const nombresCampos = llaves.map((key) => {
            return (
              META_KEY_TRADUCCION[key] || key.replace(/_/g, ' ')
            ).toLowerCase();
          });

          resumenCambios = `Se actualizó: ${nombresCampos.join(', ')}`;
          resumenCambios =
            resumenCambios.charAt(0).toUpperCase() + resumenCambios.slice(1);
        }
      }

      // 2. FORMATEO DE FECHA LEGIBLE
      const fechaTexto = `Fecha: ${new Date(item.fechaISO).toLocaleString(
        'es-ES',
        {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        },
      )}`;

      // 3. DETERMINAR EL RESUMEN FINAL
      let resumenFinal = '';

      if (esAccionSimpleNodo) {
        // PRIORIDAD: Detalle del nodo (nombre/código) > Notas del admin > Fallback
        resumenFinal =
          item.detalleVisualRapido ||
          item.metadata?.newValue?.notes ||
          'Acción sobre nodo';
      } else {
        // Para lo demás: Prioridad Nota > Resumen Automático > Fallback
        resumenFinal =
          item.metadata?.newValue?.notes ||
          resumenCambios ||
          FALLBACK_TRADUCCION.SIN_OBSERVACIONES;
      }

      // 4. RETORNO DEL OBJETO MAPEADO
      return {
        ...item,
        accionTraducida: ACCION_TRADUCCION[item.accion] || item.accion,
        fechaTexto: fechaTexto,
        resumenDinamico: resumenFinal,
        metadataList: this.parsearMetadata(item),
      };
    });
  }
  private parsearMetadata(
    auditItem: AuditoriaAdmin,
  ): { key: string; value: any }[] {
    const metadata = auditItem.metadata;
    if (!metadata) return [];
    const list: { key: string; value: any }[] = [];

    // 1. IDENTIDAD: Datos fijos del Nodo (vengan o no en el JSON de cambios)
    // Usamos los campos del objeto 'auditItem' que mapeamos en cargarAuditoria
    if (auditItem.alarmaId) {
      list.push({ key: 'Nombre del Nodo', value: auditItem.alarmaNombre });
      list.push({ key: 'Código de Alarma', value: auditItem.alarmaCodigo });
      list.push({ key: 'Ubicación / Zona', value: auditItem.alarmaUbicacion });
    }

    // 2. AFECTADO: Si la acción fue sobre otro usuario
    if (metadata.affectedUser) {
      list.push({
        key: 'Usuario Afectado',
        value: metadata.affectedUser.full_name || metadata.affectedUser.email,
      });
    }

    // 3. DETALLE DINÁMICO: Cambios específicos en los campos
    if (metadata.newValue && typeof metadata.newValue === 'object') {
      Object.keys(metadata.newValue).forEach((key) => {
        // Evitamos duplicar datos de identidad que ya pusimos en la sección 1
        if (['name', 'code', 'description'].includes(key)) return;

        // Traducir etiqueta del campo usando META_KEY_TRADUCCION (desde app.constants.ts)
        const label =
          META_KEY_TRADUCCION[key] || key.replace(/_/g, ' ').toUpperCase();

        const valorNuevo = metadata.newValue[key];
        const valorViejo = metadata.oldValue ? metadata.oldValue[key] : null;

        /**
         * Formateador de valores:
         * Convierte null, undefined, booleanos y estados técnicos (PENDING)
         * a sus versiones legibles en español usando VALORES_TRADUCCION.
         */
        const formatear = (v: any) => {
          if (v === null || v === undefined || v === '') {
            return FALLBACK_TRADUCCION.GENERICO; // Retorna "---"
          }
          // Buscamos en el diccionario de valores (ej: true -> 'HABILITADO')
          return VALORES_TRADUCCION[String(v)] || v;
        };

        // Si existe un valor previo y es distinto al actual, mostramos comparativa
        if (
          valorViejo !== null &&
          valorViejo !== undefined &&
          valorViejo !== valorNuevo
        ) {
          list.push({
            key: `${label} (Anterior)`,
            value: formatear(valorViejo),
          });
          list.push({
            key: `${label} (Actualizado)`,
            value: formatear(valorNuevo),
          });
        } else {
          // Si no hay valor anterior (es un registro nuevo o dato informativo)
          list.push({
            key: label,
            value: formatear(valorNuevo),
          });
        }
      });
    }

    return list;
  }
  obtenerColorEstado(accion: string): string {
    if (GREEN_STATUS_ACTIONS.includes(accion)) return 'bg-green';
    if (RED_STATUS_ACTIONS.includes(accion)) return 'bg-red';
    return 'bg-neutral';
  }

  // --- EL TEXTO DEL MODAL ---
  obtenerClaseTexto(accion: string): string {
    if (GREEN_STATUS_ACTIONS.includes(accion)) return 'text-green';
    if (RED_STATUS_ACTIONS.includes(accion)) return 'text-red';
    return '';
  }

  // --- MODALES Y HELPERS ---
  limpiarFiltroFechas() {
    this.fechaInicioISO = null;
    this.fechaFinISO = null;
    this.modalFechasOpen = false;
    this.cargarAuditoria();
  }

  limpiarTodo() {
    this.fechaInicioISO = null;
    this.fechaFinISO = null;
    this.alarmaSeleccionadaId = null;
    this.adminSeleccionadoId = null;
    this.modoHistorialAlarmas = false;
    this.cargarAuditoria();
  }

  abrirModalDetalle(item: AuditoriaAdmin) {
    this.itemSeleccionado = item;
    this.modalDetalleOpen = true;
  }
  cerrarModalDetalle() {
    this.modalDetalleOpen = false;
    this.itemSeleccionado = null;
  }

  abrirModalFechas() {
    this.modalFechasOpen = true;
  }
  cerrarModalFechas() {
    this.modalFechasOpen = false;
  }
  aplicarFiltroFechas() {
    this.cargarAuditoria();
    this.modalFechasOpen = false;
  }

  abrirModalAlarma() {
    this.modalAlarmaOpen = true;
  }
  cerrarModalAlarma() {
    this.modalAlarmaOpen = false;
  }
  seleccionarAlarma() {
    // Si seleccionamos una alarma específica, activamos el modo historial
    // para ver encendidos/apagados.
    this.modoHistorialAlarmas = this.alarmaSeleccionadaId !== null;
    this.cargarAuditoria();
    this.modalAlarmaOpen = false;
  }

  abrirModalAdmin() {
    this.modalAdminOpen = true;
  }
  cerrarModalAdmin() {
    this.modalAdminOpen = false;
  }
  seleccionarAdmin() {
    this.modoHistorialAlarmas = false;
    this.cargarAuditoria();
    this.modalAdminOpen = false;
  }
}
