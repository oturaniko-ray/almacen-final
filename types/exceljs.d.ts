// types/exceljs.d.ts
declare module 'exceljs' {
  export class Workbook {
    addWorksheet(name: string): Worksheet;
    getWorksheet(name: string): Worksheet | undefined;
    xlsx: {
      writeBuffer(): Promise<Buffer>;
      writeFile(path: string): Promise<void>;
    };
    creator?: string;
    created?: Date;
    modified?: Date;
    lastModifiedBy?: string;
  }

  export interface Worksheet {
    name: string;
    getCell(address: string): Cell;
    getRow(index: number): Row;
    getColumn(index: number): Column;
    addRow(data: any[]): Row;
    addRows(data: any[][]): void;
    mergeCells(start: string, end: string): void;
    mergeCells(startRow: number, startCol: number, endRow: number, endCol: number): void;
    columns: Column[];
    rows: Row[];
    eachRow(callback: (row: Row, rowNumber: number) => void): void;
  }

  export interface Column {
    width?: number;
    hidden?: boolean;
    eachCell(callback: (cell: Cell, colNumber: number) => void): void;
  }

  export interface Row {
    getCell(index: number): Cell;
    getCell(address: string): Cell;
    height?: number;
    hidden?: boolean;
    values: any[];
    eachCell(callback: (cell: Cell, colNumber: number) => void): void;
  }

  export interface Cell {
    value: any;
    font?: Partial<Font>;
    alignment?: Partial<Alignment>;
    fill?: Partial<Fill>;
    border?: Partial<Border>;
    numFmt?: string;
    protection?: Protection;
    style?: Style;
    formula?: string;
    result?: any;
    merge?: boolean;
    address: string;
    row: number;
    col: number;
  }

  export interface Font {
    name?: string;
    size?: number;
    family?: number;
    scheme?: 'minor' | 'major' | 'none';
    charset?: number;
    color?: Partial<Color>;
    bold?: boolean;
    italic?: boolean;
    underline?: boolean | 'double' | 'single' | 'none';
    strike?: boolean;
    outline?: boolean;
    vertAlign?: 'superscript' | 'subscript' | 'none';
  }

  export interface Color {
    argb: string;
    rgb: string;
    theme: number;
    indexed: number;
  }

  export interface Alignment {
    horizontal: 'left' | 'center' | 'right' | 'fill' | 'justify' | 'centerContinuous' | 'distributed';
    vertical: 'top' | 'middle' | 'bottom' | 'distributed' | 'justify';
    wrapText: boolean;
    indent: number;
    readingOrder: 'rtl' | 'ltr';
    textRotation: number | 'vertical';
  }

  export interface Fill {
    type: 'pattern' | 'gradient';
    pattern: 'none' | 'solid' | 'darkGray' | 'mediumGray' | 'lightGray' | 'gray125' | 'gray0625' | 'darkHorizontal' | 'darkVertical' | 'darkDown' | 'darkUp' | 'darkGrid' | 'darkTrellis' | 'lightHorizontal' | 'lightVertical' | 'lightDown' | 'lightUp' | 'lightGrid' | 'lightTrellis';
    fgColor?: Partial<Color>;
    bgColor?: Partial<Color>;
    gradient?: 'angle' | 'path';
    degree?: number;
    stops?: Array<{ position: number; color: Partial<Color> }>;
  }

  export interface Border {
    top?: Partial<BorderEdge>;
    bottom?: Partial<BorderEdge>;
    left?: Partial<BorderEdge>;
    right?: Partial<BorderEdge>;
    diagonal?: Partial<BorderEdge>;
    diagonalUp?: boolean;
    diagonalDown?: boolean;
  }

  export interface BorderEdge {
    style: 'thin' | 'dotted' | 'dashDot' | 'hair' | 'dashDotDot' | 'slantDashDot' | 'mediumDashed' | 'mediumDashDotDot' | 'mediumDashDot' | 'medium' | 'double' | 'thick';
    color?: Partial<Color>;
  }

  export interface Protection {
    locked: boolean;
    hidden: boolean;
  }

  export interface Style {
    font?: Partial<Font>;
    alignment?: Partial<Alignment>;
    fill?: Partial<Fill>;
    border?: Partial<Border>;
    numFmt?: string;
    protection?: Partial<Protection>;
  }

  export namespace stream {
    class xlsx {
      constructor(options: any);
      read(data: any): Promise<any>;
    }
  }
}