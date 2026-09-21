import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  ArrowRight,
  ArrowLeft,
  Search,
  Plus,
  X,
  Edit2,
  Trash2,
  Check,
  AlertTriangle,
} from 'lucide-react';
import { RequerimientoDraft, MaestroParadero, ComedorPersonalDraft } from '../types';
import { getStoredParaderos, getStoredComedores, subscribeToDataChanges } from '../services/storageService';

interface Step2PersonnelQuantityProps {
  draft: RequerimientoDraft;
  onUpdateDraft: (partial: Partial<RequerimientoDraft>) => void;
  onNext: () => void;
  onPrev: () => void;
}

const DEFAULT_COLUMNS = ['57', '63', '65', 'G1'];

export const Step2PersonnelQuantity: React.FC<Step2PersonnelQuantityProps> = ({
  draft,
  onUpdateDraft,
  onNext,
  onPrev,
}) => {
  const [paraderosMaster, setParaderosMaster] = useState<MaestroParadero[]>(() => getStoredParaderos());
  const [searchTerm, setSearchTerm] = useState('');

  // Sincronizar paraderos si cambian o se importan
  useEffect(() => {
    const unsub = subscribeToDataChanges(() => {
      setParaderosMaster(getStoredParaderos());
    });
    return unsub;
  }, []);

  // Inline editing for column headers
  const [editingCol, setEditingCol] = useState<string | null>(null);
  const [editColValue, setEditColValue] = useState<string>('');
  const editInputRef = useRef<HTMLInputElement>(null);

  // Column pending deletion confirmation
  const [colToDelete, setColToDelete] = useState<{ name: string; totalPersonas: number } | null>(null);

  // Inline adding for new column
  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const [newColValue, setNewColValue] = useState('');
  const addInputRef = useRef<HTMLInputElement>(null);

  // Focus input when editing starts
  useEffect(() => {
    if (editingCol && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingCol]);

  // Focus input when add mode is toggled
  useEffect(() => {
    if (isAddingColumn && addInputRef.current) {
      addInputRef.current.focus();
    }
  }, [isAddingColumn]);

  // Extract initial columns from draft comedores or default to stored comedores / DEFAULT_COLUMNS
  const initialColumns = useMemo(() => {
    if (draft.comedores && draft.comedores.length > 0) {
      const names = draft.comedores.map((c) => c.comedor).filter(Boolean);
      if (names.length > 0) return names;
    }
    const stored = getStoredComedores();
    if (stored.length > 0) return stored.slice(0, 4).map((c) => c.comedor);
    return DEFAULT_COLUMNS;
  }, [draft.comedores]);

  const [columns, setColumns] = useState<string[]>(initialColumns);

  // Initialize matrix state from draft
  const [matrix, setMatrix] = useState<Record<string, Record<string, number>>>(() => {
    const initial: Record<string, Record<string, number>> = {};

    // 1. Check if draft has matrizCantidades
    if (draft.matrizCantidades && Object.keys(draft.matrizCantidades).length > 0) {
      Object.entries(draft.matrizCantidades).forEach(([paradero, colMap]) => {
        if (colMap && typeof colMap === 'object') {
          const validCols: Record<string, number> = {};
          Object.entries(colMap).forEach(([c, v]) => {
            const num = Number(v) || 0;
            if (num > 0) validCols[c] = num;
          });
          if (Object.keys(validCols).length > 0) {
            initial[paradero] = validCols;
          }
        }
      });
      return initial;
    }

    // 2. Or if draft has comedores array
    if (draft.comedores && draft.comedores.length > 0) {
      draft.comedores.forEach((c) => {
        const colName = c.comedor || '57';
        Object.entries(c.paraderosCantidades || {}).forEach(([paradero, rawQty]) => {
          const qty = Number(rawQty) || 0;
          if (qty > 0) {
            if (!initial[paradero]) initial[paradero] = {};
            initial[paradero][colName] = qty;
          }
        });
      });
      return initial;
    }

    // 3. Or fallback to cantidadesPorParadero (assign to first column)
    if (draft.cantidadesPorParadero && Object.keys(draft.cantidadesPorParadero).length > 0) {
      const defaultCol = initialColumns[0] || '57';
      Object.entries(draft.cantidadesPorParadero).forEach(([paradero, rawQty]) => {
        const qty = typeof rawQty === 'number' ? rawQty : Number(rawQty) || 0;
        if (qty > 0) {
          initial[paradero] = { [defaultCol]: qty };
        }
      });
      return initial;
    }

    return initial;
  });

  // Filter all paraderos by search term
  const filteredParaderos = useMemo(() => {
    if (!searchTerm.trim()) return paraderosMaster;
    const term = searchTerm.trim().toLowerCase();
    return paraderosMaster.filter((p) =>
      p.paradero.toLowerCase().includes(term)
    );
  }, [paraderosMaster, searchTerm]);

  // Sync state to parent draft
  const syncToDraft = useCallback((
    newMatrix: Record<string, Record<string, number>>,
    currentCols: string[]
  ) => {
    // Build comedores array
    const newComedores: ComedorPersonalDraft[] = currentCols.map((col) => {
      const paraderosMap: Record<string, number> = {};
      Object.entries(newMatrix).forEach(([paradero, cols]) => {
        const qty = cols[col] || 0;
        if (qty > 0) {
          paraderosMap[paradero] = qty;
        }
      });
      return {
        comedor: col,
        paraderosCantidades: paraderosMap,
      };
    });

    // Build consolidated cantidadesPorParadero
    const consolidatedTotals: Record<string, number> = {};
    Object.entries(newMatrix).forEach(([paradero, cols]) => {
      const total = Object.values(cols).reduce((s, v) => s + (Number(v) || 0), 0);
      if (total > 0) {
        consolidatedTotals[paradero] = total;
      }
    });

    onUpdateDraft({
      comedores: newComedores,
      matrizCantidades: newMatrix,
      cantidadesPorParadero: consolidatedTotals,
    });
  }, [onUpdateDraft]);

  // Synchronize whenever matrix or columns change
  useEffect(() => {
    syncToDraft(matrix, columns);
  }, [matrix, columns, syncToDraft]);

  // Handle cell quantity change
  const handleCellChange = (paradero: string, col: string, rawVal: string) => {
    const clean = rawVal.replace(/\D/g, '');
    const num = clean === '' ? 0 : parseInt(clean, 10);

    setMatrix((prev) => {
      const next = { ...prev };
      const curRow = { ...(next[paradero] || {}) };
      if (num === 0) {
        delete curRow[col];
        if (Object.keys(curRow).length === 0) {
          delete next[paradero];
        } else {
          next[paradero] = curRow;
        }
      } else {
        curRow[col] = num;
        next[paradero] = curRow;
      }
      return next;
    });
  };

  // Calculate totals
  const getRowTotal = (paradero: string) => {
    const row = matrix[paradero] || {};
    return columns.reduce((acc, col) => acc + (row[col] || 0), 0);
  };

  const getColTotal = (col: string): number => {
    return Object.values(matrix).reduce<number>((acc, row) => {
      return acc + (Number(row[col]) || 0);
    }, 0);
  };

  // Start renaming a column header
  const handleStartRename = (col: string) => {
    setEditingCol(col);
    setEditColValue(col);
  };

  // Save renamed column header
  const handleSaveRename = (oldName: string) => {
    const trimmed = editColValue.trim().toUpperCase();
    // If the user erased the name completely, interpret as request to delete!
    if (!trimmed) {
      setEditingCol(null);
      setEditColValue('');
      handlePromptDelete(oldName);
      return;
    }

    if (trimmed === oldName) {
      setEditingCol(null);
      setEditColValue('');
      return;
    }

    if (columns.includes(trimmed)) {
      setEditingCol(null);
      setEditColValue('');
      return;
    }

    const nextCols = columns.map((c) => (c === oldName ? trimmed : c));
    const nextMatrix: Record<string, Record<string, number>> = {};
    Object.entries(matrix).forEach(([paradero, cols]) => {
      const updatedCols: Record<string, number> = {};
      Object.entries(cols).forEach(([c, val]) => {
        if (c === oldName) {
          updatedCols[trimmed] = val;
        } else {
          updatedCols[c] = val;
        }
      });
      nextMatrix[paradero] = updatedCols;
    });

    setColumns(nextCols);
    setMatrix(nextMatrix);
    syncToDraft(nextMatrix, nextCols);

    setEditingCol(null);
    setEditColValue('');
  };

  // Add new column
  const handleConfirmAddColumn = () => {
    const trimmed = newColValue.trim().toUpperCase();
    if (trimmed && !columns.includes(trimmed)) {
      const nextCols = [...columns, trimmed];
      setColumns(nextCols);
      syncToDraft(matrix, nextCols);
    }
    setNewColValue('');
    setIsAddingColumn(false);
  };

  // Request column deletion with verification
  const handlePromptDelete = (colName: string) => {
    const total = getColTotal(colName);
    if (total > 0) {
      setColToDelete({ name: colName, totalPersonas: total });
    } else {
      executeRemoveColumn(colName);
    }
  };

  // Execute removal of a column cleanly
  const executeRemoveColumn = (colToRemove: string) => {
    if (columns.length <= 1) {
      // If deleting the only remaining column, reset to an empty 'Comedor 1' with 0 passengers
      const resetCols = ['Comedor 1'];
      const resetMatrix: Record<string, Record<string, number>> = {};
      setColumns(resetCols);
      setMatrix(resetMatrix);
      syncToDraft(resetMatrix, resetCols);
      setEditingCol(null);
      setColToDelete(null);
      return;
    }

    const nextCols = columns.filter((c) => c !== colToRemove);
    const nextMatrix: Record<string, Record<string, number>> = {};
    Object.entries(matrix).forEach(([paradero, cols]) => {
      const updated: Record<string, number> = { ...(cols as Record<string, number> || {}) };
      delete updated[colToRemove];
      nextMatrix[paradero] = updated;
    });

    setColumns(nextCols);
    setMatrix(nextMatrix);
    syncToDraft(nextMatrix, nextCols);
    setEditingCol(null);
    setColToDelete(null);
  };

  const grandTotal = useMemo(() => {
    return Object.values(matrix).reduce<number>((acc, row) => {
      return acc + Object.values(row).reduce<number>((s, v) => s + (Number(v) || 0), 0);
    }, 0);
  }, [matrix]);

  return (
    <div className="w-full max-w-lg mx-auto flex flex-col space-y-3 pb-8">
      {/* Search Input Only */}
      <div className="relative w-full">
        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Buscar paradero..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-xl text-xs sm:text-sm text-[#173B56] placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#00843D] shadow-2xs"
        />
      </div>

      {/* TABLE MATCHING USER IMAGE EXACTLY */}
      <div className="bg-white rounded-2xl border border-sky-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs select-none">
            {/* Table Header: Paradero | [Comedores Editables] | [+] | Total */}
            <thead>
              <tr className="bg-[#EBF3F9] text-[#173B56] border-b border-sky-200/70">
                {/* Fixed Paradero Header */}
                <th className="sticky left-0 bg-[#EBF3F9] py-2.5 px-3 text-left font-bold text-xs sm:text-sm tracking-tight w-2/5 min-w-[120px] z-20 border-r border-sky-100">
                  Paradero
                </th>

                {/* Editable Comedor Columns */}
                {columns.map((col) => {
                  const isEditing = editingCol === col;
                  return (
                    <th
                      key={col}
                      className={`py-2 px-1 text-center font-bold text-xs sm:text-sm tracking-tight transition-all ${
                        isEditing ? 'min-w-[150px] bg-white shadow-xs z-20' : 'min-w-[56px] group'
                      }`}
                    >
                      {isEditing ? (
                        <div className="flex items-center justify-center gap-1 bg-white p-1 rounded-lg border-2 border-[#00843D] shadow-xs">
                          <input
                            ref={editInputRef}
                            type="text"
                            value={editColValue}
                            onChange={(e) => setEditColValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveRename(col);
                              if (e.key === 'Escape') setEditingCol(null);
                            }}
                            className="w-14 h-6 px-1 text-center font-black text-xs text-[#173B56] bg-emerald-50/50 rounded border border-emerald-200 outline-none"
                            placeholder="Nombre"
                          />
                          {/* Botón Guardar Nombre */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSaveRename(col);
                            }}
                            title="Guardar nombre"
                            className="w-6 h-6 flex items-center justify-center text-white bg-[#00843D] hover:bg-[#006e33] active:scale-95 rounded transition-all shadow-2xs shrink-0"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          {/* Botón Eliminar Comedor en Edición */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePromptDelete(col);
                            }}
                            title={`Eliminar comedor ${col}`}
                            className="w-6 h-6 flex items-center justify-center text-red-600 hover:text-white hover:bg-red-600 active:scale-95 border border-red-200 hover:border-transparent rounded transition-all shadow-2xs shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          {/* Botón Cancelar */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingCol(null);
                            }}
                            title="Cancelar"
                            className="w-5 h-6 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition-all shrink-0"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-0.5">
                          <button
                            type="button"
                            onClick={() => handleStartRename(col)}
                            title="Clic para editar nombre del comedor"
                            className="text-[#173B56] font-extrabold text-xs sm:text-sm hover:text-[#00843D] hover:underline cursor-pointer flex items-center gap-0.5 py-0.5 px-1 rounded transition-colors group-hover:scale-105"
                          >
                            <span>{col}</span>
                            <Edit2 className="w-2.5 h-2.5 text-gray-400 group-hover:text-[#00843D] transition-colors" />
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePromptDelete(col);
                            }}
                            title={`Eliminar comedor ${col}`}
                            className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                          >
                            <Trash2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                          </button>
                        </div>
                      )}
                    </th>
                  );
                })}

                {/* Dedicated [+] Add Comedor Button in Header */}
                <th className="py-2.5 px-1 text-center font-bold text-xs tracking-tight min-w-[40px]">
                  {isAddingColumn ? (
                    <div className="flex items-center justify-center gap-0.5">
                      <input
                        ref={addInputRef}
                        type="text"
                        placeholder="Nombre"
                        value={newColValue}
                        onChange={(e) => setNewColValue(e.target.value)}
                        onBlur={handleConfirmAddColumn}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleConfirmAddColumn();
                          if (e.key === 'Escape') {
                            setIsAddingColumn(false);
                            setNewColValue('');
                          }
                        }}
                        className="w-14 h-6 px-1 text-center font-black text-xs text-[#173B56] bg-white border-2 border-[#00843D] rounded-md shadow-2xs outline-none"
                      />
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsAddingColumn(true)}
                      title="Agregar comedor"
                      className="w-7 h-7 rounded-lg bg-white/90 hover:bg-[#00843D] text-[#00843D] hover:text-white border border-[#00843D]/30 hover:border-transparent transition-all flex items-center justify-center mx-auto shadow-2xs group"
                    >
                      <Plus className="w-4 h-4 group-hover:scale-110 transition-transform" />
                    </button>
                  )}
                </th>

                {/* Row Total Header */}
                <th className="py-2.5 px-2 text-center font-bold text-xs sm:text-sm tracking-tight w-12 min-w-[44px]">
                  Total
                </th>
              </tr>
            </thead>

            {/* Table Body: Each Paradero in row */}
            <tbody className="divide-y divide-gray-100">
              {filteredParaderos.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length + 3}
                    className="py-8 text-center text-gray-400 italic text-xs"
                  >
                    No se encontraron paraderos con el filtro aplicado
                  </td>
                </tr>
              ) : (
                filteredParaderos.map((item) => {
                  const rowTotal = getRowTotal(item.paradero);
                  const isRowActive = rowTotal > 0;

                  return (
                    <tr
                      key={item.paradero}
                      className={`hover:bg-sky-50/40 transition-colors ${
                        isRowActive ? 'bg-emerald-50/20' : ''
                      }`}
                    >
                      {/* Fixed Paradero Name */}
                      <td className="sticky left-0 bg-white group-hover:bg-sky-50/40 py-2 px-3 font-semibold text-[#173B56] text-xs sm:text-[13px] leading-tight z-10 border-r border-gray-100">
                        {item.paradero}
                      </td>

                      {/* Inputs per Comedor Column */}
                      {columns.map((col) => {
                        const cellVal = matrix[item.paradero]?.[col];
                        const displayVal =
                          cellVal !== undefined && cellVal > 0 ? String(cellVal) : '';

                        return (
                          <td key={col} className="py-1.5 px-1 text-center">
                            <input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              value={displayVal}
                              onChange={(e) =>
                                handleCellChange(item.paradero, col, e.target.value)
                              }
                              onFocus={(e) => e.target.select()}
                              className={`w-9 h-7 sm:w-10 sm:h-8 rounded-md border text-center font-bold text-xs sm:text-sm text-[#173B56] transition-all focus:outline-none focus:ring-1 focus:ring-[#00843D] focus:border-[#00843D] ${
                                displayVal !== ''
                                  ? 'border-emerald-300 bg-white font-black shadow-2xs'
                                  : 'border-gray-200/90 bg-white hover:border-gray-300'
                              }`}
                            />
                          </td>
                        );
                      })}

                      {/* Empty cell below [+] column */}
                      <td className="py-1.5 px-1 text-center text-gray-200">
                        -
                      </td>

                      {/* Row Total */}
                      <td className="py-2 px-2 text-center font-bold text-xs sm:text-sm text-[#173B56]">
                        {rowTotal}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>

            {/* Table Footer: Total General */}
            <tfoot>
              <tr className="bg-[#E0F2FE] text-[#173B56] border-t-2 border-sky-300/60">
                <td className="sticky left-0 bg-[#E0F2FE] py-2.5 px-3 font-extrabold text-xs sm:text-sm text-left tracking-tight z-20 border-r border-sky-200">
                  Total
                </td>
                {columns.map((col) => {
                  const colSum = getColTotal(col);
                  return (
                    <td
                      key={col}
                      className="py-2.5 px-1 text-center font-extrabold text-xs sm:text-sm text-[#173B56]"
                    >
                      {colSum}
                    </td>
                  );
                })}
                {/* Empty cell under [+] */}
                <td className="py-2.5 px-1 text-center font-bold text-xs text-sky-400">
                  •
                </td>
                <td className="py-2.5 px-2 text-center font-extrabold text-xs sm:text-sm text-[#173B56]">
                  {grandTotal}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Action Buttons: [ <- Atrás ]   [ Siguiente -> ] */}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="button"
          id="btn-paraderos-atras"
          onClick={onPrev}
          className="flex-1 py-3 px-4 bg-[#EBF2F7] hover:bg-[#dfeaf2] active:bg-[#d0dfeb] text-[#173B56] font-bold text-sm rounded-xl transition-all flex items-center justify-center gap-2 shadow-2xs"
        >
          <ArrowLeft className="w-4 h-4 text-[#173B56]" />
          <span>Atrás</span>
        </button>

        <button
          type="button"
          id="btn-paraderos-siguiente"
          onClick={() => {
            syncToDraft(matrix, columns);
            onNext();
          }}
          className="flex-1 py-3 px-4 bg-[#00843D] hover:bg-[#007034] active:bg-[#005c2b] text-white font-bold text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
        >
          <span>Siguiente</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Modal de Confirmación para Eliminar Comedor */}
      {colToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-gray-100 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-black text-[#173B56]">
                  ¿Eliminar comedor "{colToDelete.name}"?
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Esta acción quitará el comedor de la tabla.
                </p>
              </div>
            </div>

            {colToDelete.totalPersonas > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  Este comedor tiene <strong>{colToDelete.totalPersonas} personas</strong> registradas. Al eliminarlo, se descontarán del total del requerimiento.
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setColToDelete(null)}
                className="px-4 py-2 text-xs font-bold text-gray-600 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => executeRemoveColumn(colToDelete.name)}
                className="px-4 py-2 text-xs font-black text-white bg-red-600 hover:bg-red-700 active:bg-red-800 rounded-xl shadow-xs transition-all flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Sí, eliminar comedor</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
