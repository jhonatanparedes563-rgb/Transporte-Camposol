import * as XLSX from 'xlsx';
import { Requerimiento, DetalleRequerimiento } from '../types';
import { inferParaderoZona } from './storageService';

/**
 * Formatea de forma segura la hora en que el usuario registró la solicitud (ej. 02:30:15 p. m.)
 */
export function formatHoraRegistro(fechaIso?: string): string {
  if (!fechaIso) return '';
  try {
    const hasTimePart = fechaIso.includes('T') || fechaIso.includes(':');
    if (!hasTimePart) return '';
    const d = new Date(fechaIso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('es-PE', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  } catch {
    return '';
  }
}

export interface ParaderoConsolidado {
  paradero: string;
  zona: 'NORTE' | 'SUR';
  totalPersonas: number;
  comedoresDetalle: { comedor: string; cantidad: number }[];
  porcentaje?: number;
}

/**
 * Agrupa y consolida los detalles de un requerimiento (o varios) por paradero,
 * sumando las cantidades de distintos comedores para evitar repeticiones.
 */
export function consolidarParaderos(detalles: DetalleRequerimiento[]): ParaderoConsolidado[] {
  const map = new Map<string, ParaderoConsolidado>();

  detalles.forEach((d) => {
    const nombre = (d.paradero || '').trim();
    if (!nombre) return;

    // Priorizar siempre la zona definida en el maestro de paraderos por el usuario
    const zona = inferParaderoZona(nombre) || d.zona || 'NORTE';
    const existing = map.get(nombre);

    if (existing) {
      existing.totalPersonas += Number(d.cantidad) || 0;
      existing.comedoresDetalle.push({
        comedor: d.comedor || 'Comedor General',
        cantidad: Number(d.cantidad) || 0,
      });
    } else {
      map.set(nombre, {
        paradero: nombre,
        zona,
        totalPersonas: Number(d.cantidad) || 0,
        comedoresDetalle: [
          {
            comedor: d.comedor || 'Comedor General',
            cantidad: Number(d.cantidad) || 0,
          },
        ],
      });
    }
  });

  const list = Array.from(map.values());
  const grandTotal = list.reduce((acc, curr) => acc + curr.totalPersonas, 0);

  list.forEach((item) => {
    item.porcentaje = grandTotal > 0 ? Math.round((item.totalPersonas / grandTotal) * 1000) / 10 : 0;
  });

  // Ordenar de mayor cantidad a menor cantidad
  return list.sort((a, b) => b.totalPersonas - a.totalPersonas);
}

/**
 * Genera un archivo Excel (.xlsx) completo y profesional diseñado específicamente
 * para facilitar la SUMA y análisis en Microsoft Excel.
 */
export function exportarExcelOperativoCompleto(
  requerimientos: Requerimiento[],
  todosLosDetalles: DetalleRequerimiento[],
  nombreArchivo = `CAMPOSOL_Reporte_Transporte_${new Date().toISOString().slice(0, 10)}.xlsx`
): void {
  const workbook = XLSX.utils.book_new();

  // -------------------------------------------------------------
  // HOJA 1: DETALLE PARA SUMAS (1 fila por paradero con Cantidad Numérica)
  // -------------------------------------------------------------
  const detalleRows: Record<string, string | number>[] = [];
  let sumaTotalPersonas = 0;

  requerimientos.forEach((req) => {
    const dets = todosLosDetalles.filter((d) => d.requerimientoId === req.id || d.numeroRequerimiento === req.numeroRequerimiento);

    if (dets.length === 0) {
      // Si no tiene paraderos desglosados, incluir al menos la fila cabecera
      detalleRows.push({
        'Código Requerimiento': req.numeroRequerimiento,
        'Fecha': req.fecha,
        'Hora Registro': formatHoraRegistro(req.fechaRegistro) || '',
        'Hora Recojo': req.horaRecojo,
        'Hora Salida': req.horaSalida,
        'Área': req.area,
        'Fundo': req.fundo,
        'Movimiento': req.movimiento,
        'Supervisor Solicitante': req.usuario || 'Supervisor',
        'Comedor / Parcela': 'General',
        'Zona': 'NORTE',
        'Paradero': 'Sin desglose',
        'Cantidad Personas (SUMAR)': Number(req.totalPersonas) || 0,
        'Total del Requerimiento': Number(req.totalPersonas) || 0,
        'Estado': req.estado,
        'Observaciones': req.observaciones || '',
      });
      sumaTotalPersonas += Number(req.totalPersonas) || 0;
    } else {
      dets.forEach((d) => {
        const cant = Number(d.cantidad) || 0;
        sumaTotalPersonas += cant;
        detalleRows.push({
          'Código Requerimiento': req.numeroRequerimiento,
          'Fecha': req.fecha,
          'Hora Registro': formatHoraRegistro(req.fechaRegistro) || '',
          'Hora Recojo': req.horaRecojo,
          'Hora Salida': req.horaSalida,
          'Área': req.area,
          'Fundo': req.fundo,
          'Movimiento': req.movimiento,
          'Supervisor Solicitante': req.usuario || 'Supervisor',
          'Comedor / Parcela': d.comedor || 'Comedor Principal',
          'Zona': d.zona || inferParaderoZona(d.paradero),
          'Paradero': d.paradero,
          'Cantidad Personas (SUMAR)': cant,
          'Total del Requerimiento': Number(req.totalPersonas) || 0,
          'Estado': req.estado,
          'Observaciones': req.observaciones || '',
        });
      });
    }
  });

  // Fila de TOTAL para facilitar la suma al usuario en Excel
  detalleRows.push({
    'Código Requerimiento': 'TOTAL GENERAL',
    'Fecha': '',
    'Hora Registro': '',
    'Hora Recojo': '',
    'Hora Salida': '',
    'Área': '',
    'Fundo': '',
    'Movimiento': '',
    'Supervisor Solicitante': '',
    'Comedor / Parcela': '',
    'Zona': '',
    'Paradero': 'TOTAL SUMADO',
    'Cantidad Personas (SUMAR)': sumaTotalPersonas,
    'Total del Requerimiento': sumaTotalPersonas,
    'Estado': '',
    'Observaciones': `Total de ${requerimientos.length} requerimientos`,
  });

  const sheetDetalle = XLSX.utils.json_to_sheet(detalleRows);
  sheetDetalle['!cols'] = [
    { wch: 18 }, // Código
    { wch: 12 }, // Fecha
    { wch: 15 }, // Hora Registro
    { wch: 12 }, // Hora Recojo
    { wch: 12 }, // Hora Salida
    { wch: 16 }, // Área
    { wch: 18 }, // Fundo
    { wch: 12 }, // Movimiento
    { wch: 22 }, // Supervisor
    { wch: 20 }, // Comedor
    { wch: 10 }, // Zona
    { wch: 26 }, // Paradero
    { wch: 22 }, // Cantidad Personas
    { wch: 20 }, // Total Requerimiento
    { wch: 14 }, // Estado
    { wch: 30 }, // Observaciones
  ];
  XLSX.utils.book_append_sheet(workbook, sheetDetalle, '1. Detalle Para Sumas');

  // -------------------------------------------------------------
  // HOJA 2: RESUMEN CONSOLIDADO POR PARADERO (CON SUB-TOTALES POR ZONA)
  // -------------------------------------------------------------
  const consolidadoGlobal = consolidarParaderos(todosLosDetalles);
  const surGlobal = consolidadoGlobal.filter((p) => p.zona === 'SUR');
  const norteGlobal = consolidadoGlobal.filter((p) => p.zona === 'NORTE');
  const sumaSurGlobal = surGlobal.reduce((acc, p) => acc + p.totalPersonas, 0);
  const sumaNorteGlobal = norteGlobal.reduce((acc, p) => acc + p.totalPersonas, 0);

  const resumenParaderoRows: Record<string, string | number>[] = [];

  // 1. Filas Zona Sur
  surGlobal.forEach((p, idx) => {
    resumenParaderoRows.push({
      'N°': idx + 1,
      'Paradero': p.paradero,
      'Zona': p.zona,
      'Total Pasajeros (SUMAR)': p.totalPersonas,
      '% del Total': `${p.porcentaje}%`,
      'Buses Estimados (40p)': Math.ceil(p.totalPersonas / 40),
      'Detalle Comedores / Desglose': p.comedoresDetalle.map((c) => `${c.comedor}: ${c.cantidad}`).join(' | '),
    });
  });

  if (surGlobal.length > 0) {
    resumenParaderoRows.push({
      'N°': 'SUBTOTAL',
      'Paradero': `SUBTOTAL ZONA SUR (${surGlobal.length} paraderos)`,
      'Zona': 'SUR',
      'Total Pasajeros (SUMAR)': sumaSurGlobal,
      '% del Total': `${sumaTotalPersonas > 0 ? Math.round((sumaSurGlobal / sumaTotalPersonas) * 1000) / 10 : 0}%`,
      'Buses Estimados (40p)': Math.ceil(sumaSurGlobal / 40),
      'Detalle Comedores / Desglose': `Subtotal para flota Zona Sur (~${Math.ceil(sumaSurGlobal / 40)} bus(es))`,
    });
  }

  // 2. Filas Zona Norte
  norteGlobal.forEach((p, idx) => {
    resumenParaderoRows.push({
      'N°': idx + 1,
      'Paradero': p.paradero,
      'Zona': p.zona,
      'Total Pasajeros (SUMAR)': p.totalPersonas,
      '% del Total': `${p.porcentaje}%`,
      'Buses Estimados (40p)': Math.ceil(p.totalPersonas / 40),
      'Detalle Comedores / Desglose': p.comedoresDetalle.map((c) => `${c.comedor}: ${c.cantidad}`).join(' | '),
    });
  });

  if (norteGlobal.length > 0) {
    resumenParaderoRows.push({
      'N°': 'SUBTOTAL',
      'Paradero': `SUBTOTAL ZONA NORTE (${norteGlobal.length} paraderos)`,
      'Zona': 'NORTE',
      'Total Pasajeros (SUMAR)': sumaNorteGlobal,
      '% del Total': `${sumaTotalPersonas > 0 ? Math.round((sumaNorteGlobal / sumaTotalPersonas) * 1000) / 10 : 0}%`,
      'Buses Estimados (40p)': Math.ceil(sumaNorteGlobal / 40),
      'Detalle Comedores / Desglose': `Subtotal para flota Zona Norte (~${Math.ceil(sumaNorteGlobal / 40)} bus(es))`,
    });
  }

  // Fila Total Resumen
  resumenParaderoRows.push({
    'N°': 'TOTAL',
    'Paradero': 'GRAN TOTAL GENERAL',
    'Zona': 'TODAS',
    'Total Pasajeros (SUMAR)': sumaTotalPersonas,
    '% del Total': '100%',
    'Buses Estimados (40p)': Math.ceil(sumaTotalPersonas / 40),
    'Detalle Comedores / Desglose': `Suma global (${consolidadoGlobal.length} paraderos)`,
  });

  const sheetResumen = XLSX.utils.json_to_sheet(resumenParaderoRows);
  sheetResumen['!cols'] = [
    { wch: 10 },
    { wch: 34 },
    { wch: 12 },
    { wch: 24 },
    { wch: 14 },
    { wch: 22 },
    { wch: 45 },
  ];
  XLSX.utils.book_append_sheet(workbook, sheetResumen, '2. Resumen Por Paradero');

  // -------------------------------------------------------------
  // HOJA 4 (NUEVA): RESUMEN EJECUTIVO POR ZONAS (NORTE / SUR)
  // -------------------------------------------------------------
  const zonasSummaryRows = [
    {
      'Zona Operativa': 'ZONA SUR',
      'Cantidad de Paraderos': surGlobal.length,
      'Total Pasajeros (SUMAR)': sumaSurGlobal,
      '% del Total': `${sumaTotalPersonas > 0 ? Math.round((sumaSurGlobal / sumaTotalPersonas) * 1000) / 10 : 0}%`,
      'Buses Estimados (40 pers/bus)': Math.ceil(sumaSurGlobal / 40),
      'Ocupación Estimada': `${sumaSurGlobal} / ${Math.ceil(sumaSurGlobal / 40) * 40} asientos`,
      'Paraderos Incluidos': surGlobal.map((p) => `${p.paradero} (${p.totalPersonas})`).join(', '),
    },
    {
      'Zona Operativa': 'ZONA NORTE',
      'Cantidad de Paraderos': norteGlobal.length,
      'Total Pasajeros (SUMAR)': sumaNorteGlobal,
      '% del Total': `${sumaTotalPersonas > 0 ? Math.round((sumaNorteGlobal / sumaTotalPersonas) * 1000) / 10 : 0}%`,
      'Buses Estimados (40 pers/bus)': Math.ceil(sumaNorteGlobal / 40),
      'Ocupación Estimada': `${sumaNorteGlobal} / ${Math.ceil(sumaNorteGlobal / 40) * 40} asientos`,
      'Paraderos Incluidos': norteGlobal.map((p) => `${p.paradero} (${p.totalPersonas})`).join(', '),
    },
    {
      'Zona Operativa': 'TOTAL GENERAL',
      'Cantidad de Paraderos': consolidadoGlobal.length,
      'Total Pasajeros (SUMAR)': sumaTotalPersonas,
      '% del Total': '100%',
      'Buses Estimados (40 pers/bus)': Math.ceil(sumaTotalPersonas / 40),
      'Ocupación Estimada': `${sumaTotalPersonas} / ${Math.ceil(sumaTotalPersonas / 40) * 40} asientos`,
      'Paraderos Incluidos': 'Todos los paraderos requeridos',
    },
  ];

  const sheetZonas = XLSX.utils.json_to_sheet(zonasSummaryRows);
  sheetZonas['!cols'] = [
    { wch: 18 },
    { wch: 22 },
    { wch: 24 },
    { wch: 14 },
    { wch: 28 },
    { wch: 22 },
    { wch: 60 },
  ];
  XLSX.utils.book_append_sheet(workbook, sheetZonas, '4. Resumen Zonas Norte-Sur');

  // -------------------------------------------------------------
  // HOJA 3: MATRIZ CRUZADA (Columnas Numéricas por Paradero)
  // -------------------------------------------------------------
  // Obtener lista única de todos los paraderos presentes
  const paraderosUnicos = Array.from(new Set(todosLosDetalles.map((d) => (d.paradero || '').trim()))).filter(Boolean);

  const matrizRows: Record<string, string | number>[] = [];
  const sumaPorColumna: Record<string, number> = {};
  paraderosUnicos.forEach((p) => {
    sumaPorColumna[p] = 0;
  });

  requerimientos.forEach((req) => {
    const dets = todosLosDetalles.filter((d) => d.requerimientoId === req.id || d.numeroRequerimiento === req.numeroRequerimiento);
    const row: Record<string, string | number> = {
      'Código': req.numeroRequerimiento,
      'Fecha': req.fecha,
      'Hora Registro': formatHoraRegistro(req.fechaRegistro) || '',
      'Área': req.area,
      'Fundo': req.fundo,
      'Supervisor': req.usuario || 'Supervisor',
      'Movimiento': req.movimiento,
      'Total General': Number(req.totalPersonas) || 0,
    };

    // Calcular cantidad para cada paradero en este requerimiento
    paraderosUnicos.forEach((p) => {
      const cantParadero = dets
        .filter((d) => (d.paradero || '').trim() === p)
        .reduce((sum, d) => sum + (Number(d.cantidad) || 0), 0);

      row[p] = cantParadero; // Valor numérico puro (ej. 7, 0, 4)
      sumaPorColumna[p] = (sumaPorColumna[p] || 0) + cantParadero;
    });

    matrizRows.push(row);
  });

  // Fila Total Matriz
  const filaTotalMatriz: Record<string, string | number> = {
    'Código': 'TOTAL SUMAS',
    'Fecha': '',
    'Hora Registro': '',
    'Área': '',
    'Fundo': '',
    'Supervisor': '',
    'Movimiento': '',
    'Total General': sumaTotalPersonas,
  };
  paraderosUnicos.forEach((p) => {
    filaTotalMatriz[p] = sumaPorColumna[p] || 0;
  });
  matrizRows.push(filaTotalMatriz);

  const sheetMatriz = XLSX.utils.json_to_sheet(matrizRows);
  const matrizCols = [
    { wch: 16 },
    { wch: 12 },
    { wch: 15 }, // Hora Registro
    { wch: 16 },
    { wch: 18 },
    { wch: 22 },
    { wch: 12 },
    { wch: 14 },
    ...paraderosUnicos.map(() => ({ wch: 16 })),
  ];
  sheetMatriz['!cols'] = matrizCols;
  XLSX.utils.book_append_sheet(workbook, sheetMatriz, '3. Matriz de Paraderos');

  // Descargar el libro Excel directamente
  XLSX.writeFile(workbook, nombreArchivo);
}

/**
 * Exporta el desglose específico de UN requerimiento a un Excel limpio con totales listos para sumar.
 */
export function exportarRequerimientoIndividualExcel(
  req: Requerimiento,
  detalles: DetalleRequerimiento[]
): void {
  const consolidado = consolidarParaderos(detalles);
  const workbook = XLSX.utils.book_new();

  const surList = consolidado.filter((c) => c.zona === 'SUR');
  const norteList = consolidado.filter((c) => c.zona === 'NORTE');
  const totalSur = surList.reduce((acc, c) => acc + c.totalPersonas, 0);
  const totalNorte = norteList.reduce((acc, c) => acc + c.totalPersonas, 0);
  const totalGeneral = consolidado.reduce((acc, c) => acc + c.totalPersonas, 0);

  const rows: Record<string, string | number>[] = [];

  // 1. Bloque Zona Sur
  surList.forEach((c, i) => {
    rows.push({
      'N°': i + 1,
      'Código Requerimiento': req.numeroRequerimiento,
      'Supervisor Solicitante': req.usuario || 'Supervisor',
      'Fecha': req.fecha,
      'Hora Registro': formatHoraRegistro(req.fechaRegistro) || '',
      'Área': req.area,
      'Fundo': req.fundo,
      'Movimiento': req.movimiento,
      'Hora Recojo': req.horaRecojo,
      'Hora Salida': req.horaSalida,
      'Paradero': c.paradero,
      'Zona': c.zona,
      'Cantidad Pasajeros (NUMÉRICO)': c.totalPersonas,
      '% del Total': `${c.porcentaje}%`,
      'Comedores que Solicitaron': c.comedoresDetalle.map((x) => `${x.comedor} (${x.cantidad})`).join(' | '),
    });
  });

  if (surList.length > 0) {
    rows.push({
      'N°': 'SUBTOTAL',
      'Código Requerimiento': req.numeroRequerimiento,
      'Supervisor Solicitante': req.usuario || 'Supervisor',
      'Fecha': req.fecha,
      'Hora Registro': '',
      'Área': req.area,
      'Fundo': req.fundo,
      'Movimiento': req.movimiento,
      'Hora Recojo': req.horaRecojo,
      'Hora Salida': req.horaSalida,
      'Paradero': `SUBTOTAL ZONA SUR (${surList.length} paraderos)`,
      'Zona': 'SUR',
      'Cantidad Pasajeros (NUMÉRICO)': totalSur,
      '% del Total': `${totalGeneral > 0 ? Math.round((totalSur / totalGeneral) * 1000) / 10 : 0}%`,
      'Comedores que Solicitaron': `Subtotal consolidado Zona Sur (${surList.length} paraderos)`,
    });
  }

  // 2. Bloque Zona Norte
  norteList.forEach((c, i) => {
    rows.push({
      'N°': i + 1,
      'Código Requerimiento': req.numeroRequerimiento,
      'Supervisor Solicitante': req.usuario || 'Supervisor',
      'Fecha': req.fecha,
      'Hora Registro': formatHoraRegistro(req.fechaRegistro) || '',
      'Área': req.area,
      'Fundo': req.fundo,
      'Movimiento': req.movimiento,
      'Hora Recojo': req.horaRecojo,
      'Hora Salida': req.horaSalida,
      'Paradero': c.paradero,
      'Zona': c.zona,
      'Cantidad Pasajeros (NUMÉRICO)': c.totalPersonas,
      '% del Total': `${c.porcentaje}%`,
      'Comedores que Solicitaron': c.comedoresDetalle.map((x) => `${x.comedor} (${x.cantidad})`).join(' | '),
    });
  });

  if (norteList.length > 0) {
    rows.push({
      'N°': 'SUBTOTAL',
      'Código Requerimiento': req.numeroRequerimiento,
      'Supervisor Solicitante': req.usuario || 'Supervisor',
      'Fecha': req.fecha,
      'Hora Registro': '',
      'Área': req.area,
      'Fundo': req.fundo,
      'Movimiento': req.movimiento,
      'Hora Recojo': req.horaRecojo,
      'Hora Salida': req.horaSalida,
      'Paradero': `SUBTOTAL ZONA NORTE (${norteList.length} paraderos)`,
      'Zona': 'NORTE',
      'Cantidad Pasajeros (NUMÉRICO)': totalNorte,
      '% del Total': `${totalGeneral > 0 ? Math.round((totalNorte / totalGeneral) * 1000) / 10 : 0}%`,
      'Comedores que Solicitaron': `Subtotal consolidado Zona Norte (${norteList.length} paraderos)`,
    });
  }

  // 3. Fila Gran Total
  rows.push({
    'N°': 'TOTAL',
    'Código Requerimiento': req.numeroRequerimiento,
    'Supervisor Solicitante': req.usuario || 'Supervisor',
    'Fecha': req.fecha,
    'Hora Registro': '',
    'Área': req.area,
    'Fundo': req.fundo,
    'Movimiento': req.movimiento,
    'Hora Recojo': req.horaRecojo,
    'Hora Salida': req.horaSalida,
    'Paradero': 'GRAN TOTAL REQUERIMIENTO',
    'Zona': 'TODAS',
    'Cantidad Pasajeros (NUMÉRICO)': totalGeneral,
    '% del Total': '100%',
    'Comedores que Solicitaron': `Total de ${consolidado.length} paraderos solicitados`,
  });

  const sheet = XLSX.utils.json_to_sheet(rows);
  sheet['!cols'] = [
    { wch: 10 },
    { wch: 18 },
    { wch: 22 },
    { wch: 12 },
    { wch: 15 }, // Hora Registro
    { wch: 16 },
    { wch: 18 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 30 },
    { wch: 10 },
    { wch: 26 },
    { wch: 14 },
    { wch: 45 },
  ];
  XLSX.utils.book_append_sheet(workbook, sheet, `REQ_${req.numeroRequerimiento}`);

  // Hoja 2: Resumen Ejecutivo por Zonas
  const resumenZonasRows = [
    {
      'Zona Operativa': 'ZONA SUR',
      'Cantidad de Paraderos': surList.length,
      'Total Pasajeros (NUMÉRICO)': totalSur,
      '% del Requerimiento': `${totalGeneral > 0 ? Math.round((totalSur / totalGeneral) * 1000) / 10 : 0}%`,
      'Detalle Paraderos': surList.map((p) => `${p.paradero}: ${p.totalPersonas}`).join(' | '),
    },
    {
      'Zona Operativa': 'ZONA NORTE',
      'Cantidad de Paraderos': norteList.length,
      'Total Pasajeros (NUMÉRICO)': totalNorte,
      '% del Requerimiento': `${totalGeneral > 0 ? Math.round((totalNorte / totalGeneral) * 1000) / 10 : 0}%`,
      'Detalle Paraderos': norteList.map((p) => `${p.paradero}: ${p.totalPersonas}`).join(' | '),
    },
    {
      'Zona Operativa': 'TOTAL GENERAL',
      'Cantidad de Paraderos': consolidado.length,
      'Total Pasajeros (NUMÉRICO)': totalGeneral,
      '% del Requerimiento': '100%',
      'Detalle Paraderos': `Suma consolidada de todos los comedores (${req.area} - ${req.fundo})`,
    },
  ];

  const sheetResumenZonas = XLSX.utils.json_to_sheet(resumenZonasRows);
  sheetResumenZonas['!cols'] = [
    { wch: 16 },
    { wch: 22 },
    { wch: 24 },
    { wch: 20 },
    { wch: 20 },
    { wch: 60 },
  ];
  XLSX.utils.book_append_sheet(workbook, sheetResumenZonas, 'Resumen por Zona');

  XLSX.writeFile(workbook, `CAMPOSOL_${req.numeroRequerimiento}_Paraderos_${req.fecha}.xlsx`);
}
