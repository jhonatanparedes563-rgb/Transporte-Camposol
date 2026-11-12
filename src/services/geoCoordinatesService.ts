import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import { GeoPoint, FundoFolder } from '../data/camposolGeoData';
import { normalizeParaderoKey } from '../data/masterData';

const STORAGE_KEY_CUSTOM_POINTS = 'camposol_custom_geopoints_v1';
const STORAGE_KEY_CUSTOM_FOLDERS = 'camposol_custom_folders_v1';

export interface ParsedGeoImportResult {
  puntos: GeoPoint[];
  carpetas: FundoFolder[];
  rutas: Array<{ nombre: string; coordenadas: [number, number][] }>;
  totalComedores: number;
  totalParaderos: number;
  totalOtros: number;
  mensaje: string;
}

// ----------------------------------------------------------------------
// 1. PARSER DE KML XML (DOMParser nativo del navegador)
// ----------------------------------------------------------------------
export function parseKMLString(kmlText: string): ParsedGeoImportResult {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(kmlText, 'text/xml');

  const parserError = xmlDoc.getElementsByTagName('parsererror');
  if (parserError.length > 0) {
    throw new Error('El archivo KML contiene un formato XML no válido.');
  }

  const puntos: GeoPoint[] = [];
  const rutas: Array<{ nombre: string; coordenadas: [number, number][] }> = [];
  const carpetasMap = new Map<string, GeoPoint[]>();

  // Helper para determinar tipo y cultivo según nombre y contexto
  const clasificarPunto = (nombre: string, folderName: string): {
    tipo: GeoPoint['tipo'];
    cultivo: GeoPoint['cultivo'];
    fundo: string;
    zona: 'NORTE' | 'SUR';
  } => {
    const n = nombre.toUpperCase();
    const f = folderName.toUpperCase();

    // Tipo
    let tipo: GeoPoint['tipo'] = 'COMEDOR';
    if (n.includes('PARADERO') || n.includes('PAR-') || f.includes('PARADERO')) {
      tipo = 'PARADERO';
    } else if (n.includes('GARITA') || n.includes('GAR-')) {
      tipo = 'GARITA';
    } else if (n.includes('ACOPIO') || n.includes('ACO-') || n.includes('COMPOSTERA')) {
      tipo = 'ACOPIO';
    } else if (n.includes('PLATAFORMA') || n.includes('EMBALSE') || n.includes('BIOFABRICA')) {
      tipo = 'PLATAFORMA';
    } else if (
      n.includes('PUERTO') ||
      n.includes('CARMELO') ||
      n.includes('SANTORIN') ||
      n.includes('ALPAMAYO') ||
      n.includes('GAVIOTAS') ||
      n.includes('LEON') ||
      n.includes('COSTA')
    ) {
      tipo = 'SECTOR_COSTA';
    }

    // Cultivo
    let cultivo: GeoPoint['cultivo'] = 'GENERAL';
    if (n.includes('ARAND') || f.includes('ARAND')) {
      cultivo = 'ARÁNDANO';
    } else if (n.includes('PALTO') || f.includes('PALTO')) {
      cultivo = 'PALTO';
    } else if (n.includes('MANDAR') || f.includes('MANDAR')) {
      cultivo = 'MANDARINA';
    } else if (n.includes('ESPAR') || f.includes('ESPAR')) {
      cultivo = 'ESPÁRRAGO';
    }

    // Fundo
    let fundo = folderName || 'CAMPOSOL';
    if (n.includes('AGRICULTOR 1') || f.includes('AGRICULTOR 1')) fundo = 'AGRICULTOR 1';
    else if (n.includes('AGRICULTOR 2') || f.includes('AGRICULTOR 2')) fundo = 'AGRICULTOR 2';
    else if (n.includes('MAR VERDE') || f.includes('MAR VERDE')) fundo = 'MAR VERDE';
    else if (n.includes('GLORIA') || f.includes('GLORIA')) fundo = 'GLORIA';
    else if (n.includes('ARENAL') || f.includes('ARENAL')) fundo = 'ARENAL';
    else if (n.includes('CHAO') || f.includes('CHAO')) fundo = 'CHAO';
    else if (n.includes('YAKU') || f.includes('YAKU')) fundo = 'YAKU';
    else if (n.includes('COMPOSTERA') || f.includes('COMPOSTERA')) fundo = 'FUNDO COMPOSTERA';
    else if (tipo === 'SECTOR_COSTA') fundo = 'SECTOR COSTA';
    else if (tipo === 'PARADERO') fundo = n.includes('VIRU') ? 'VIRÚ' : 'CHAO';

    // Zona
    const zona: 'NORTE' | 'SUR' =
      fundo.includes('VIRU') ||
      fundo.includes('COSTA') ||
      fundo.includes('COMPOSTERA') ||
      n.includes('VIRU')
        ? 'NORTE'
        : 'SUR';

    return { tipo, cultivo, fundo, zona };
  };

  // Buscar todos los placemarks dentro de carpetas o en raíz
  const placemarks = xmlDoc.getElementsByTagName('Placemark');

  for (let i = 0; i < placemarks.length; i++) {
    const pm = placemarks[i];
    const nameEl = pm.getElementsByTagName('name')[0];
    const nombre = nameEl ? nameEl.textContent?.trim() || `Punto ${i + 1}` : `Punto ${i + 1}`;

    const descEl = pm.getElementsByTagName('description')[0];
    const descripcion = descEl ? descEl.textContent?.trim() : undefined;

    // Obtener la carpeta padre si existe
    let parentFolder = 'Comedores Camposol 2025';
    let parentNode = pm.parentNode;
    while (parentNode) {
      if (parentNode.nodeName === 'Folder') {
        const folderNameEl = (parentNode as Element).getElementsByTagName('name')[0];
        if (folderNameEl && folderNameEl.textContent) {
          parentFolder = folderNameEl.textContent.trim();
          break;
        }
      }
      parentNode = parentNode.parentNode;
    }

    // 1. Caso Punto (Point)
    const pointEl = pm.getElementsByTagName('Point')[0];
    if (pointEl) {
      const coordEl = pointEl.getElementsByTagName('coordinates')[0];
      if (coordEl && coordEl.textContent) {
        const parts = coordEl.textContent.trim().split(/[\s,]+/);
        if (parts.length >= 2) {
          const lng = parseFloat(parts[0]);
          const lat = parseFloat(parts[1]);

          if (!isNaN(lat) && !isNaN(lng)) {
            const { tipo, cultivo, fundo, zona } = clasificarPunto(nombre, parentFolder);

            const punto: GeoPoint = {
              id: `geo-custom-${Date.now()}-${i}`,
              nombre,
              codigo: nombre.length <= 12 ? nombre : undefined,
              tipo,
              cultivo,
              fundo,
              zona,
              lat,
              lng,
              descripcion,
            };

            puntos.push(punto);

            const list = carpetasMap.get(fundo) || [];
            list.push(punto);
            carpetasMap.set(fundo, list);
          }
        }
      }
    }

    // 2. Caso Línea / Ruta (LineString)
    const lineEl = pm.getElementsByTagName('LineString')[0];
    if (lineEl) {
      const coordEl = lineEl.getElementsByTagName('coordinates')[0];
      if (coordEl && coordEl.textContent) {
        const coordLines = coordEl.textContent.trim().split(/\s+/);
        const coordenadas: [number, number][] = [];
        coordLines.forEach((c) => {
          const parts = c.split(',');
          if (parts.length >= 2) {
            const lng = parseFloat(parts[0]);
            const lat = parseFloat(parts[1]);
            if (!isNaN(lat) && !isNaN(lng)) {
              coordenadas.push([lat, lng]);
            }
          }
        });

        if (coordenadas.length > 1) {
          rutas.push({ nombre, coordenadas });
        }
      }
    }
  }

  // Armar carpetas
  const colores = ['#0284c7', '#16a34a', '#dc2626', '#d97706', '#9333ea', '#0d9488', '#84cc16', '#ea580c'];
  let colIdx = 0;
  const carpetas: FundoFolder[] = [];

  carpetasMap.forEach((pts, fundoNombre) => {
    carpetas.push({
      id: `folder-custom-${colIdx}`,
      nombre: fundoNombre,
      cultivo: pts[0]?.cultivo || 'GENERAL',
      visible: true,
      color: colores[colIdx % colores.length],
      puntos: pts,
    });
    colIdx++;
  });

  const totalComedores = puntos.filter((p) => p.tipo === 'COMEDOR').length;
  const totalParaderos = puntos.filter((p) => p.tipo === 'PARADERO').length;
  const totalOtros = puntos.length - totalComedores - totalParaderos;

  return {
    puntos,
    carpetas,
    rutas,
    totalComedores,
    totalParaderos,
    totalOtros,
    mensaje: `Se leyeron correctamente ${puntos.length} puntos de coordenadas (${totalComedores} comedores, ${totalParaderos} paraderos).`,
  };
}

// ----------------------------------------------------------------------
// 2. PARSER DE KMZ (ZIP CON DOC.KML)
// ----------------------------------------------------------------------
export async function parseKMZBuffer(arrayBuffer: ArrayBuffer): Promise<ParsedGeoImportResult> {
  const zip = new JSZip();
  const loadedZip = await zip.loadAsync(arrayBuffer);

  // Buscar doc.kml o cualquier archivo que termine en .kml
  let kmlFile = loadedZip.file('doc.kml');
  if (!kmlFile) {
    const kmlFiles = Object.keys(loadedZip.files).filter((k) => k.toLowerCase().endsWith('.kml'));
    if (kmlFiles.length > 0) {
      kmlFile = loadedZip.file(kmlFiles[0]);
    }
  }

  if (!kmlFile) {
    throw new Error('El archivo KMZ no contiene un archivo KML interno válido (doc.kml).');
  }

  const kmlText = await kmlFile.async('string');
  return parseKMLString(kmlText);
}

// ----------------------------------------------------------------------
// 3. PARSER DE EXCEL / CSV CON COORDENADAS
// ----------------------------------------------------------------------
export function parseExcelCoordinates(arrayBuffer: ArrayBuffer): ParsedGeoImportResult {
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rawRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(worksheet);

  if (rawRows.length === 0) {
    throw new Error('La hoja de cálculo está vacía.');
  }

  const puntos: GeoPoint[] = [];
  const carpetasMap = new Map<string, GeoPoint[]>();

  rawRows.forEach((row, idx) => {
    // Buscar columnas de latitud y longitud flexibles
    const getVal = (keys: string[]): unknown => {
      for (const k of keys) {
        const found = Object.keys(row).find(
          (rk) => rk.toLowerCase().trim() === k.toLowerCase().trim()
        );
        if (found && row[found] !== undefined && row[found] !== null && row[found] !== '') {
          return row[found];
        }
      }
      return null;
    };

    const nombreRaw = getVal(['nombre', 'punto', 'comedor', 'paradero', 'descripcion', 'name']);
    const nombre = nombreRaw ? String(nombreRaw).trim() : `Punto ${idx + 1}`;

    const latRaw = getVal(['latitud', 'lat', 'latitude', 'y', 'coord_y']);
    const lngRaw = getVal(['longitud', 'lng', 'lon', 'longitude', 'x', 'coord_x']);

    const fundoRaw = getVal(['fundo', 'sector', 'zona_fundo', 'area']);
    const fundo = fundoRaw ? String(fundoRaw).trim() : 'CAMPOSOL';

    const tipoRaw = getVal(['tipo', 'categoria', 'clase']);
    const tipoStr = tipoRaw ? String(tipoRaw).toUpperCase().trim() : '';

    let tipo: GeoPoint['tipo'] = 'COMEDOR';
    if (tipoStr.includes('PARADERO') || nombre.toUpperCase().includes('PARADERO')) {
      tipo = 'PARADERO';
    } else if (tipoStr.includes('GARITA') || nombre.toUpperCase().includes('GARITA')) {
      tipo = 'GARITA';
    } else if (tipoStr.includes('ACOPIO')) {
      tipo = 'ACOPIO';
    } else if (tipoStr.includes('PLATAFORMA')) {
      tipo = 'PLATAFORMA';
    } else if (tipoStr.includes('COSTA')) {
      tipo = 'SECTOR_COSTA';
    }

    const capRaw = getVal(['capacidad', 'aforo', 'cap', 'pax']);
    const capacidad = capRaw ? Number(capRaw) : undefined;

    const zonaRaw = getVal(['zona', 'region']);
    const zona: 'NORTE' | 'SUR' = String(zonaRaw).toUpperCase().includes('NORTE') ? 'NORTE' : 'SUR';

    if (latRaw !== null && lngRaw !== null) {
      const lat = parseFloat(String(latRaw).replace(',', '.'));
      const lng = parseFloat(String(lngRaw).replace(',', '.'));

      if (!isNaN(lat) && !isNaN(lng)) {
        const punto: GeoPoint = {
          id: `excel-pt-${Date.now()}-${idx}`,
          nombre,
          codigo: nombre.length <= 10 ? nombre : undefined,
          tipo,
          cultivo: 'ARÁNDANO',
          fundo,
          zona,
          lat,
          lng,
          capacidad: !isNaN(capacidad || NaN) ? capacidad : undefined,
        };
        puntos.push(punto);

        const list = carpetasMap.get(fundo) || [];
        list.push(punto);
        carpetasMap.set(fundo, list);
      }
    }
  });

  const colores = ['#0284c7', '#16a34a', '#dc2626', '#d97706', '#9333ea', '#0d9488'];
  let colIdx = 0;
  const carpetas: FundoFolder[] = [];

  carpetasMap.forEach((pts, fundoNombre) => {
    carpetas.push({
      id: `folder-excel-${colIdx}`,
      nombre: fundoNombre,
      cultivo: pts[0]?.cultivo || 'GENERAL',
      visible: true,
      color: colores[colIdx % colores.length],
      puntos: pts,
    });
    colIdx++;
  });

  return {
    puntos,
    carpetas,
    rutas: [],
    totalComedores: puntos.filter((p) => p.tipo === 'COMEDOR').length,
    totalParaderos: puntos.filter((p) => p.tipo === 'PARADERO').length,
    totalOtros: puntos.filter((p) => p.tipo !== 'COMEDOR' && p.tipo !== 'PARADERO').length,
    mensaje: `Se importaron ${puntos.length} coordenadas desde la hoja de cálculo.`,
  };
}

// ----------------------------------------------------------------------
// 4. PARSER DE TEXTO PEGADO (CSV, TSV O KML)
// ----------------------------------------------------------------------
export function parseRawPastedCoordinates(text: string): ParsedGeoImportResult {
  const trimmed = text.trim();
  if (trimmed.startsWith('<') && (trimmed.includes('<kml') || trimmed.includes('<Placemark'))) {
    return parseKMLString(trimmed);
  }

  // Parsear línea por línea como CSV o TSV
  const lines = trimmed.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const puntos: GeoPoint[] = [];

  lines.forEach((line, idx) => {
    // Detectar separador (coma, tab, punto y coma, o espacio doble)
    const delimiter = line.includes('\t')
      ? '\t'
      : line.includes(';')
      ? ';'
      : line.includes(',')
      ? ','
      : ' ';

    const cols = line.split(delimiter).map((c) => c.trim().replace(/^["']|["']$/g, ''));
    if (cols.length >= 2) {
      // Buscar columnas numéricas que correspondan a latitud y longitud
      let lat = NaN;
      let lng = NaN;
      let nombre = `Punto ${idx + 1}`;

      cols.forEach((val, colIdx) => {
        const num = parseFloat(val.replace(',', '.'));
        if (!isNaN(num)) {
          if (num >= -90 && num <= 90 && isNaN(lat)) {
            // En Perú las latitudes son negativas entre -3 y -18
            if (num < 0 && num > -20) {
              lat = num;
            } else if (isNaN(lat)) {
              lat = num;
            }
          } else if (num >= -180 && num <= 180 && isNaN(lng)) {
            // En Perú las longitudes son negativas entre -68 y -82
            if (num < -60 && num > -85) {
              lng = num;
            } else if (isNaN(lng)) {
              lng = num;
            }
          }
        } else if (val.length > 1 && nombre === `Punto ${idx + 1}`) {
          nombre = val;
        }
      });

      if (!isNaN(lat) && !isNaN(lng)) {
        puntos.push({
          id: `pasted-pt-${Date.now()}-${idx}`,
          nombre,
          tipo: nombre.toUpperCase().includes('PARADERO') ? 'PARADERO' : 'COMEDOR',
          cultivo: 'ARÁNDANO',
          fundo: 'COORDENADAS USUARIO',
          zona: lat > -8.43 ? 'NORTE' : 'SUR',
          lat,
          lng,
        });
      }
    }
  });

  if (puntos.length === 0) {
    throw new Error('No se detectaron coordenadas válidas en el texto. Formato sugerido: Nombre, Latitud, Longitud');
  }

  return {
    puntos,
    carpetas: [
      {
        id: 'folder-pasted',
        nombre: 'COORDENADAS USUARIO',
        cultivo: 'ARÁNDANO',
        visible: true,
        color: '#0284c7',
        puntos,
      },
    ],
    rutas: [],
    totalComedores: puntos.filter((p) => p.tipo === 'COMEDOR').length,
    totalParaderos: puntos.filter((p) => p.tipo === 'PARADERO').length,
    totalOtros: 0,
    mensaje: `Se procesaron exitosamente ${puntos.length} puntos desde el texto ingresado.`,
  };
}

// ----------------------------------------------------------------------
// 5. GESTIÓN DE ALMACENAMIENTO PERSISTENTE DE COORDENADAS
// ----------------------------------------------------------------------
export function getStoredCustomGeoPoints(): GeoPoint[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CUSTOM_POINTS);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
  } catch {
    return null;
  }
}

export function saveCustomGeoPoints(puntos: GeoPoint[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_CUSTOM_POINTS, JSON.stringify(puntos));
  } catch (err) {
    console.warn('Error al guardar coordenadas en localStorage:', err);
  }
}

export function clearCustomGeoPoints(): void {
  localStorage.removeItem(STORAGE_KEY_CUSTOM_POINTS);
  localStorage.removeItem(STORAGE_KEY_CUSTOM_FOLDERS);
}

// ----------------------------------------------------------------------
// 6. EXPORTAR A KML OFICIAL PARA GOOGLE EARTH
// ----------------------------------------------------------------------
export function exportToKML(puntos: GeoPoint[], nombreProyecto = 'Comedores Camposol 2025'): string {
  let kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${nombreProyecto}</name>
    <description>Coordenadas Oficiales de Comedores, Fundos y Paraderos de CAMPOSOL</description>
`;

  // Agrupar por fundo
  const fundosMap = new Map<string, GeoPoint[]>();
  puntos.forEach((p) => {
    const f = p.fundo || 'GENERAL';
    const list = fundosMap.get(f) || [];
    list.push(p);
    fundosMap.set(f, list);
  });

  fundosMap.forEach((pts, fundo) => {
    kml += `    <Folder>\n      <name>${fundo}</name>\n`;
    pts.forEach((p) => {
      kml += `      <Placemark>
        <name>${p.nombre}</name>
        <description>${p.tipo} - Fundo: ${p.fundo}${p.capacidad ? ` - Capacidad: ${p.capacidad} pax` : ''}</description>
        <Point>
          <coordinates>${p.lng},${p.lat},0</coordinates>
        </Point>
      </Placemark>\n`;
    });
    kml += `    </Folder>\n`;
  });

  kml += `  </Document>\n</kml>`;
  return kml;
}
