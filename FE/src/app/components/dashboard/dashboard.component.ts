import { Component, ChangeDetectionStrategy, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';

interface ParsedItem {
  nome: string;
  codigo: string;
  tipo_item: string;
  tipo_peca: string;
  comentario: string;
  fornecimento: string;
  categoria: string;
  troca: boolean;
  remocao_instalacao: boolean;
  reparacao: boolean;
  pintura: boolean;
  preco: number;
  preco_liquido: number;
  quantidade: number;
  hora_ri: number;
  hora_reparacao: number;
  hora_pintura: number;
  valor_peca: number;
  valor_mdo_ri: number;
  valor_mdo_reparacao: number;
  valor_mdo_pintura: number;
  valor_mdo_total: number;
}

interface ParsedData {
  seguradora: string;
  numero_orcamento: string;
  numero_sinistro: string;
  cliente: any;
  veiculo: any;
  padrao_mao_de_obra: any;
  itens: ParsedItem[];
  totais: { oficina: number; seguradora: number; servico: number };
  resumo_xml: any;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent {
  private apiService = inject(ApiService);
  private authService = inject(AuthService);
  private toast = inject(ToastService);

  // Modal state
  isModalOpen = signal(false);
  modalStep = signal<1 | 2 | 3>(1); // 1: Upload, 2: Preview/Select, 3: Confirm

  // Upload state
  isDragging = signal(false);
  uploading = signal(false);
  selectedFile = signal<File | null>(null);

  // Parsed data
  parsedData = signal<ParsedData | null>(null);

  // VHSYS Client integration
  vhsysClientId = signal<number | null>(null);
  vhsysClientNotFound = signal<boolean>(false);
  searchingClient = signal<boolean>(false);

  // Import mode
  importMode = signal<'all' | 'select'>('all');

  // Selection checkboxes
  importOficina = signal(true);
  importSeguradora = signal(true);
  importServico = signal(true);

  // VHSYS Integration Status
  vhsysStatus = signal<'checking' | 'active' | 'error' | 'missing'>('checking');
  vhsysErrorMessage = signal<string | null>(null);

  // OS creation
  creatingOs = signal(false);

  // History
  history = signal<any[]>([]);
  loadingHistory = signal(false);

  ngOnInit() {
    this.loadHistory();
    this.checkVhsysStatus();
  }

  checkVhsysStatus() {
    const userId = this.authService.getUserId();
    if (!userId) return;

    this.vhsysStatus.set('checking');
    this.apiService.verifyVhsys(userId).subscribe({
      next: (res) => {
        if (res.valid) {
          this.vhsysStatus.set('active');
        } else {
          // If 401/403 or logic error returned
          this.vhsysStatus.set('error');
          this.vhsysErrorMessage.set(res.details?.message || 'Credenciais inválidas ou conta bloqueada no VHSYS.');
        }
      },
      error: (err) => {
        this.vhsysStatus.set('error');
        this.vhsysErrorMessage.set('Não foi possível conectar à API do VHSYS.');
      }
    });
  }

  loadHistory() {
    const userId = this.authService.getUserId();
    if (!userId) return;
    this.loadingHistory.set(true);
    this.apiService.getHistory(userId).subscribe({
      next: (data) => {
        this.history.set(data || []);
        this.loadingHistory.set(false);
      },
      error: () => this.loadingHistory.set(false)
    });
  }

  // ---- Modal control ----
  openModal() {
    this.isModalOpen.set(true);
    this.modalStep.set(1);
    this.selectedFile.set(null);
    this.parsedData.set(null);
    this.importMode.set('all');
    this.importOficina.set(true);
    this.importSeguradora.set(true);
    this.importServico.set(true);
  }

  closeModal() {
    this.isModalOpen.set(false);
  }

  // ---- File handling ----
  onDragOver(event: DragEvent) {
    event.preventDefault();
    this.isDragging.set(true);
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    this.isDragging.set(false);
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    this.isDragging.set(false);
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.handleFile(files[0]);
    }
  }

  onFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.handleFile(input.files[0]);
    }
  }

  handleFile(file: File) {
    if (!file.name.toLowerCase().endsWith('.xml')) {
      this.toast.error('Por favor, selecione um arquivo XML.');
      return;
    }
    this.selectedFile.set(file);
    this.uploadXml(file);
  }

  uploadXml(file: File) {
    this.uploading.set(true);
    this.apiService.uploadXml(file).subscribe({
      next: (response) => {
        if (response.status === 'success') {
          this.parsedData.set(response);
          this.searchClient(response.seguradora);
          this.modalStep.set(2);
          this.toast.success('XML processado com sucesso!');
        } else {
          this.toast.error(response.error || 'Erro ao processar XML.');
        }
        this.uploading.set(false);
      },
      error: (err) => {
        this.toast.error('Erro ao enviar XML ao servidor.');
        this.uploading.set(false);
      }
    });
  }

  searchClient(nome: string) {
    this.searchingClient.set(true);
    this.vhsysClientId.set(null);
    this.vhsysClientNotFound.set(false);

    const userId = this.authService.getUserId();
    if (!userId) return;

    this.apiService.searchClient(userId, nome).subscribe({
      next: (res) => {
        if (res && res.code === 200 && res.data && res.data.length > 0) {
          const clientData = res.data[0];
          let id = null;
          if (clientData.id_cliente) {
            id = clientData.id_cliente;
          } else if (clientData['cliente: '] && clientData['cliente: '][0]) {
            id = clientData['cliente: '][0].id_cliente;
          } else if (clientData['cliente: '] && clientData['cliente: '].id_cliente) {
            id = clientData['cliente: '].id_cliente;
          }
          
          if (id) {
            this.vhsysClientId.set(id);
          } else {
            this.vhsysClientNotFound.set(true);
          }
        } else {
          this.vhsysClientNotFound.set(true);
        }
        this.searchingClient.set(false);
      },
      error: () => {
        this.vhsysClientNotFound.set(true);
        this.searchingClient.set(false);
      }
    });
  }

  // ---- Filtered items ----
  get filteredItems(): ParsedItem[] {
    const data = this.parsedData();
    if (!data) return [];

    // Sempre exclui itens de seguradora
    const semSeguradora = data.itens.filter(item => item.categoria !== 'seguradora');

    if (this.importMode() === 'all') {
      return semSeguradora;
    }

    return semSeguradora.filter(item => {
      if (item.categoria === 'oficina' && this.importOficina()) return true;
      if (item.categoria === 'servico' && this.importServico()) return true;
      return false;
    });
  }

  get filteredTotal(): number {
    return this.filteredItems.reduce((sum, item) => {
      if (item.categoria === 'oficina') {
        return sum + item.valor_peca;
      }
      return sum + item.valor_mdo_total;
    }, 0);
  }

  getItemsByCategory(category: string): ParsedItem[] {
    return this.parsedData()?.itens.filter(i => i.categoria === category) || [];
  }

  // ---- OS Creation ----
  setImportMode(mode: 'all' | 'select') {
    this.importMode.set(mode);
  }

  confirmImport() {
    this.modalStep.set(3);
  }

  createOS() {
    const data = this.parsedData();
    if (!data) return;

    this.creatingOs.set(true);

    const items = this.filteredItems;

    // Build observacoes (orçamento completo)
    let obsInterno = `ORÇAMENTO COMPLETO - Nº ${data.numero_orcamento}\n`;
    obsInterno += `Sinistro: ${data.numero_sinistro}\n`;
    obsInterno += `Seguradora: ${data.seguradora}\n`;
    obsInterno += `---\n`;
    items.forEach(item => {
      const tipo = item.fornecimento || 'Serviço';
      const valor = item.categoria === 'oficina' || item.categoria === 'seguradora'
        ? `R$ ${item.valor_peca.toFixed(2)}`
        : `R$ ${item.valor_mdo_total.toFixed(2)} (MO)`;
      obsInterno += `[${tipo}] ${item.nome} - ${valor}\n`;
    });
    obsInterno += `---\nTOTAL: R$ ${this.filteredTotal.toFixed(2)}`;

    // Build obs_pedido (dados do cliente + veículo)
    let obsPedido = `Cliente: ${data.cliente.nome}`;
    if (data.cliente.cpf) obsPedido += ` | CPF: ${data.cliente.cpf}`;
    if (data.cliente.telefone) obsPedido += ` | Tel: ${data.cliente.telefone}`;
    if (data.veiculo.marca) obsPedido += `\nVeículo: ${data.veiculo.marca} ${data.veiculo.modelo}`;
    if (data.veiculo.placa) obsPedido += ` | Placa: ${data.veiculo.placa}`;
    if (data.veiculo.cor) obsPedido += ` | Cor: ${data.veiculo.cor}`;
    if (data.veiculo.quilometragem) obsPedido += ` | KM: ${data.veiculo.quilometragem}`;

    // Tipos importados
    const tipos: string[] = [];
    if (this.importMode() === 'all') {
      tipos.push('Oficina', 'Seguradora', 'Serviço');
    } else {
      if (this.importOficina()) tipos.push('Oficina');
      if (this.importSeguradora()) tipos.push('Seguradora');
      if (this.importServico()) tipos.push('Serviço');
    }

    const payload = {
      id_cliente: this.vhsysClientId(),
      nome_cliente: data.seguradora,
      referencia_ordem: `${data.seguradora} + ${data.veiculo.placa}`,
      obs_pedido: obsPedido,
      obs_interno_pedido: obsInterno,
      equipamento_ordem: `${data.veiculo.nome} - ${data.veiculo.marca} ${data.veiculo.modelo} - Placa: ${data.veiculo.placa}`,
      user_id: this.authService.getUserId(),
      nome_arquivo: this.selectedFile()?.name || '',
      seguradora: data.seguradora,
      placa: data.veiculo.placa,
      tipos_importados: tipos.join(', '),
      total_itens: items.length,
      valor_total: this.filteredTotal,
      itens: items,
    };

    this.apiService.createOS(payload).subscribe({
      next: (res) => {
        const responseData = typeof res === 'string' ? JSON.parse(res) : res;
        if (responseData.code === 200 || responseData.status === 'success') {
          this.toast.success('Ordem de Serviço criada com sucesso!');
          this.closeModal();
          this.loadHistory();
        } else {
          this.toast.error(responseData.data || 'Erro ao criar OS no VHSYS.');
        }
        this.creatingOs.set(false);
      },
      error: (err) => {
        this.toast.error('Erro ao comunicar com o servidor.');
        this.creatingOs.set(false);
      }
    });
  }

  // ---- Helpers ----
  getStatusClass(status: string): string {
    switch (status) {
      case 'sucesso': return 'bg-green-100 text-green-800';
      case 'erro': return 'bg-red-100 text-red-800';
      default: return 'bg-yellow-100 text-yellow-800';
    }
  }
}
