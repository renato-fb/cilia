import { ApplicationConfig, provideZoneChangeDetection, importProvidersFrom } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import {
  LucideAngularModule,
  Search, ChevronDown, ChevronUp, ChevronRight, Check,
  FileText, Eye, EyeOff, User, LogOut, Plus, MoreVertical,
  Shield, Upload, FileUp, X, AlertTriangle, CheckCircle,
  AlertCircle, Info, Lock, LayoutDashboard, Users, Settings,
  Trash2, Edit2, ToggleLeft, ToggleRight, FileSpreadsheet,
  History, Filter, Download, Key, CheckCircle2, MinusCircle
} from 'lucide-angular';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(),
    importProvidersFrom(LucideAngularModule.pick({
      Search, ChevronDown, ChevronUp, ChevronRight, Check,
      FileText, Eye, EyeOff, User, LogOut, Plus, MoreVertical,
      Shield, Upload, FileUp, X, AlertTriangle, CheckCircle,
      AlertCircle, Info, Lock, LayoutDashboard, Users, Settings,
      Trash2, Edit2, ToggleLeft, ToggleRight, FileSpreadsheet,
      History, Filter, Download, Key, CheckCircle2, MinusCircle
    }))
  ]
};
