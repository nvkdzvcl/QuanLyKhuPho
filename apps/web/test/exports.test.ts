import { describe, expect, it } from 'vitest';
import {
  ExportDataset,
  ExportFormat,
  Gender,
  PartyStatus,
} from '@quanlykhupho/shared-types';
import {
  buildExportParams,
  extractFilenameFromDisposition,
} from '../src/hooks/use-exports';
import {
  DATASET_LABELS,
  ExportModalState,
  getFormatButtonAriaProps,
  getInitialExportModalState,
  resolveExportModalTransition,
} from '../src/components/exports/export-modal';

describe('Web export download helpers', () => {
  it('serializes active filters without dropping numeric zero values', () => {
    const params = buildExportParams({
      format: ExportFormat.XLSX,
      neighborhoodId: '88888888-8888-4888-8888-888888888881',
      gender: Gender.FEMALE,
      ageFrom: 0,
      ageTo: 18,
      partyStatus: PartyStatus.PARTY_MEMBER,
      search: 'Nguyễn',
    });

    expect(params.get('format')).toBe('xlsx');
    expect(params.get('ageFrom')).toBe('0');
    expect(params.get('ageTo')).toBe('18');
    expect(params.get('partyStatus')).toBe('party_member');
    expect(params.get('search')).toBe('Nguyễn');
  });

  it('prefers and decodes an RFC 5987 filename', () => {
    const filename = extractFilenameFromDisposition(
      "attachment; filename=report.xlsx; filename*=UTF-8''bao-cao-khu-pho.xlsx",
      'fallback.xlsx',
    );

    expect(filename).toBe('bao-cao-khu-pho.xlsx');
  });

  it('falls back safely when the response has no filename', () => {
    expect(extractFilenameFromDisposition(undefined, 'fallback.csv')).toBe(
      'fallback.csv',
    );
  });
});

describe('Export dataset configuration & labels', () => {
  it('defines human-readable Vietnamese labels for all supported datasets', () => {
    expect(DATASET_LABELS[ExportDataset.RESIDENTS]).toBe('Danh sách cư dân');
    expect(DATASET_LABELS[ExportDataset.POLITICAL_SOCIAL]).toBe(
      'Thông tin Chính trị - Xã hội',
    );
    expect(DATASET_LABELS[ExportDataset.ACTIVITIES]).toBe('Sổ hoạt động khu phố');
    expect(DATASET_LABELS[ExportDataset.PETITIONS]).toBe('Danh sách kiến nghị');
  });

  it('covers every value in ExportDataset enum', () => {
    const allDatasets = Object.values(ExportDataset);
    expect(allDatasets.length).toBeGreaterThan(0);
    allDatasets.forEach((dataset) => {
      expect(DATASET_LABELS[dataset]).toBeTruthy();
      expect(typeof DATASET_LABELS[dataset]).toBe('string');
    });
  });
});

describe('Export modal state transition contracts', () => {
  it('initializes with the given dataset and default CSV format', () => {
    const state = getInitialExportModalState(ExportDataset.RESIDENTS, false);
    expect(state).toEqual<ExportModalState>({
      isOpen: false,
      selectedDataset: ExportDataset.RESIDENTS,
      selectedFormat: ExportFormat.CSV,
    });
  });

  it('initializes with open status when mounted with isOpen: true', () => {
    const state = getInitialExportModalState(ExportDataset.ACTIVITIES, true);
    expect(state).toEqual<ExportModalState>({
      isOpen: true,
      selectedDataset: ExportDataset.ACTIVITIES,
      selectedFormat: ExportFormat.CSV,
    });
  });

  it('resets dataset to the next prop and format to CSV on closed-to-open transition', () => {
    const closedState: ExportModalState = {
      isOpen: false,
      selectedDataset: ExportDataset.RESIDENTS,
      selectedFormat: ExportFormat.XLSX,
    };

    const nextState = resolveExportModalTransition(closedState, {
      isOpen: true,
      dataset: ExportDataset.POLITICAL_SOCIAL,
    });

    expect(nextState).toEqual<ExportModalState>({
      isOpen: true,
      selectedDataset: ExportDataset.POLITICAL_SOCIAL,
      selectedFormat: ExportFormat.CSV,
    });
  });

  it('resets format to CSV even when opening for the same dataset', () => {
    const closedState: ExportModalState = {
      isOpen: false,
      selectedDataset: ExportDataset.RESIDENTS,
      selectedFormat: ExportFormat.XLSX,
    };

    const nextState = resolveExportModalTransition(closedState, {
      isOpen: true,
      dataset: ExportDataset.RESIDENTS,
    });

    expect(nextState.selectedFormat).toBe(ExportFormat.CSV);
    expect(nextState.selectedDataset).toBe(ExportDataset.RESIDENTS);
    expect(nextState.isOpen).toBe(true);
  });

  it('preserves user in-progress selections while modal remains open', () => {
    // User modified selection while open
    const userModifiedState: ExportModalState = {
      isOpen: true,
      selectedDataset: ExportDataset.ACTIVITIES,
      selectedFormat: ExportFormat.XLSX,
    };

    // Parent re-renders with isOpen=true and original dataset prop
    const nextState = resolveExportModalTransition(userModifiedState, {
      isOpen: true,
      dataset: ExportDataset.RESIDENTS,
    });

    expect(nextState.selectedDataset).toBe(ExportDataset.ACTIVITIES);
    expect(nextState.selectedFormat).toBe(ExportFormat.XLSX);
    expect(nextState.isOpen).toBe(true);
  });

  it('handles closing the modal by updating isOpen to false while retaining state', () => {
    const openState: ExportModalState = {
      isOpen: true,
      selectedDataset: ExportDataset.ACTIVITIES,
      selectedFormat: ExportFormat.XLSX,
    };

    const closedState = resolveExportModalTransition(openState, {
      isOpen: false,
      dataset: ExportDataset.ACTIVITIES,
    });

    expect(closedState.isOpen).toBe(false);
    expect(closedState.selectedDataset).toBe(ExportDataset.ACTIVITIES);
    expect(closedState.selectedFormat).toBe(ExportFormat.XLSX);
  });

  it('resets cleanly across full open -> modify -> close -> reopen lifecycle', () => {
    // 1. Initial mount (closed)
    let state = getInitialExportModalState(ExportDataset.RESIDENTS, false);
    expect(state.isOpen).toBe(false);

    // 2. Open for RESIDENTS
    state = resolveExportModalTransition(state, {
      isOpen: true,
      dataset: ExportDataset.RESIDENTS,
    });
    expect(state.isOpen).toBe(true);
    expect(state.selectedDataset).toBe(ExportDataset.RESIDENTS);
    expect(state.selectedFormat).toBe(ExportFormat.CSV);

    // 3. User changes format to XLSX
    state = { ...state, selectedFormat: ExportFormat.XLSX };

    // 4. Modal closes
    state = resolveExportModalTransition(state, {
      isOpen: false,
      dataset: ExportDataset.RESIDENTS,
    });
    expect(state.isOpen).toBe(false);

    // 5. Reopen for PETITIONS
    state = resolveExportModalTransition(state, {
      isOpen: true,
      dataset: ExportDataset.PETITIONS,
    });
    expect(state.isOpen).toBe(true);
    expect(state.selectedDataset).toBe(ExportDataset.PETITIONS);
    expect(state.selectedFormat).toBe(ExportFormat.CSV);
  });
});

describe('Export modal format controls semantic & accessibility contracts', () => {
  it('exposes aria-pressed=true for selected format and false for unselected format', () => {
    const csvProps = getFormatButtonAriaProps(
      ExportFormat.CSV,
      ExportFormat.CSV,
      false,
    );
    const xlsxProps = getFormatButtonAriaProps(
      ExportFormat.XLSX,
      ExportFormat.CSV,
      false,
    );

    expect(csvProps['aria-pressed']).toBe(true);
    expect(xlsxProps['aria-pressed']).toBe(false);
  });

  it('updates aria-pressed when XLSX format is selected', () => {
    const csvProps = getFormatButtonAriaProps(
      ExportFormat.CSV,
      ExportFormat.XLSX,
      false,
    );
    const xlsxProps = getFormatButtonAriaProps(
      ExportFormat.XLSX,
      ExportFormat.XLSX,
      false,
    );

    expect(csvProps['aria-pressed']).toBe(false);
    expect(xlsxProps['aria-pressed']).toBe(true);
  });

  it('preserves type="button" on all format controls for keyboard operability', () => {
    const csvProps = getFormatButtonAriaProps(
      ExportFormat.CSV,
      ExportFormat.CSV,
    );
    const xlsxProps = getFormatButtonAriaProps(
      ExportFormat.XLSX,
      ExportFormat.CSV,
    );

    expect(csvProps.type).toBe('button');
    expect(xlsxProps.type).toBe('button');
  });

  it('reflects disabled state during active export', () => {
    const csvPropsDisabled = getFormatButtonAriaProps(
      ExportFormat.CSV,
      ExportFormat.CSV,
      true,
    );
    const xlsxPropsDisabled = getFormatButtonAriaProps(
      ExportFormat.XLSX,
      ExportFormat.CSV,
      true,
    );

    expect(csvPropsDisabled.disabled).toBe(true);
    expect(xlsxPropsDisabled.disabled).toBe(true);

    const csvPropsEnabled = getFormatButtonAriaProps(
      ExportFormat.CSV,
      ExportFormat.CSV,
      false,
    );
    expect(csvPropsEnabled.disabled).toBe(false);
  });
});
