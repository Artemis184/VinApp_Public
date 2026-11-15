import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IonButton,
  IonContent,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonRefresher,
  IonRefresherContent,
  IonSelect,
  IonSelectOption,
  IonSpinner,
} from '@ionic/angular/standalone';
import { AdminBackHeaderComponent } from 'src/app/shared/admin-back-header/admin-back-header.component';
import {
  NodeHealthLog,
  NodeHealthService,
  NodeHealthSummary,
} from '../services/node-health.service';

@Component({
  standalone: true,
  selector: 'app-graficas-salud-nodos',
  templateUrl: './graficas-salud-nodos.page.html',
  styleUrls: ['./graficas-salud-nodos.page.scss'],
  imports: [
    CommonModule,
    FormsModule,
    IonButton,
    IonContent,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonRefresher,
    IonRefresherContent,
    IonSelect,
    IonSelectOption,
    IonSpinner,
    AdminBackHeaderComponent,
  ],
})
export class GraficasSaludNodosPage implements OnInit {
  private readonly healthService = inject(NodeHealthService);

  readonly daysOptions = [7, 14, 30];
  selectedDays = 7;
  summaries: NodeHealthSummary[] = [];
  selectedNode: NodeHealthSummary | null = null;
  history: NodeHealthLog[] = [];
  loading = false;
  loadingHistory = false;
  errorMessage = '';

  get healthyCount() {
    return this.summaries.filter((node) => node.healthy && !node.sinDatos)
      .length;
  }

  get alertCount() {
    return this.summaries.filter(
      (node) => node.sinDatos || node.healthy === false,
    ).length;
  }

  get maxResets() {
    return Math.max(
      1,
      ...this.summaries.map((node) => node.resetsAnormalesEnVentana ?? 0),
    );
  }

  ngOnInit() {
    this.loadSummary();
  }

  loadSummary(event?: CustomEvent) {
    this.loading = !event;
    this.errorMessage = '';
    this.healthService.getSummary(this.selectedDays).subscribe({
      next: ({ data }) => {
        this.summaries = data ?? [];
        if (this.selectedNode) {
          this.selectedNode =
            this.summaries.find(
              (node) => node.nodeId === this.selectedNode?.nodeId,
            ) ?? null;
        }
        this.loading = false;
        event?.detail.complete();
      },
      error: () => {
        this.loading = false;
        this.errorMessage = 'No fue posible cargar el resumen de salud.';
        event?.detail.complete();
      },
    });
  }

  selectNode(node: NodeHealthSummary) {
    this.selectedNode = node;
    this.history = [];
    this.loadingHistory = true;
    this.healthService.getHistory(node.nodeId).subscribe({
      next: ({ data }) => {
        this.history = data ?? [];
        this.loadingHistory = false;
      },
      error: () => {
        this.loadingHistory = false;
        this.errorMessage = 'No fue posible cargar el historial del nodo.';
      },
    });
  }

  clearSelectedNode() {
    this.selectedNode = null;
    this.history = [];
  }

  barHeight(value: number | undefined) {
    return `${Math.max(4, ((value ?? 0) / this.maxResets) * 100)}%`;
  }

  statusLabel(node: NodeHealthSummary) {
    if (node.sinDatos) return 'Sin datos';
    return node.healthy ? 'Saludable' : 'Revisar';
  }

  formatDate(value: string | undefined) {
    return value
      ? new Intl.DateTimeFormat('es-MX', {
          dateStyle: 'short',
          timeStyle: 'short',
        }).format(new Date(value))
      : 'Sin reporte';
  }

  statusFilter: 'all' | 'ok' | 'alert' = 'all';

  get filteredSummaries() {
    if (this.statusFilter === 'ok') {
      return this.summaries.filter((n) => n.healthy && !n.sinDatos);
    }
    if (this.statusFilter === 'alert') {
      return this.summaries.filter((n) => !n.healthy || n.sinDatos);
    }
    return this.summaries;
  }

  setStatusFilter(filter: 'all' | 'ok' | 'alert') {
    this.statusFilter = filter;
  }

  toggleNode(node: any) {
    if (this.selectedNode?.nodeId === node.nodeId) {
      this.clearSelectedNode();
      return;
    }
    this.selectNode(node);
  }

  usesRepeater(node: any): boolean {
    return !!(node.uses_repeater ?? node.usesRepeater);
  }

  routeLabel(node: any): string {
    if (this.usesRepeater(node)) {
      return node.repeaterCode || node.repeater_code || 'vía repeater';
    }
    return 'directo';
  }
}
