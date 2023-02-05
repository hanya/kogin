
/// Metadata of the document.
export const Metadata = {
    title: '',
    'title-en': '',
    creationDate: '',
    author: '',
    license: '',
    keyword: '',
    description: '',
    version: '',
    copyright: '',
    type: '',
};

/// View options.
export const ViewOption = {
    // most of them are last selected value
    viewMode: 3,
    crosshair: true,
    oneToOne: false,
    oneToTwo: false,
    stitchColor: '#000000',

    selectionColor: '#000000ff',
    cursorColor: '#ff0000ff',
    overlayStitchColor: '#999999',
    pivotColor: '#ff0000',

    openFromToolbar: 'local',
    saveFromToolbar: 'local',
    askWhenClosing: true,

    defaultFileName: 'pattern.svg',
    zoomValue: 1.0,
    autoScrollOnTemplates: false,
};

/// Grid related options.
export const GridOption = {
    // show grid
    showGrid: true,
    // show grid over stitches
    overGrid: false,

    horiCount: 100,
    vertCount: 50,

    gridWidth: 16,
    gridHeight: 16,

    // width for printing, always 1px for view
    gridLineWidth: 1.0,
    gridLineColor: '#bbbbbb',

    gridMajorLineColor: '#000000',
    gridMajorLineFrequency: 5,

    // output only options
    gridMajorVertOffset: 1,
    gridMajorHoriOffset: 1,
    showGridMajorLine: true,
    showGridFrame: true,

    numberingColor: '#000000',
};

export const GridOptionForView = Object.assign({}, GridOption)
GridOptionForView.gridLineColor = '#00000020';
GridOptionForView.gridMajorLineColor = '#00000050';
GridOptionForView.numberingColor = '#00000050';

export const GridOptionForPrinting = Object.assign({}, GridOption);
// in mm
GridOptionForPrinting.gridWidth = 4;
GridOptionForPrinting.gridHeight = 4;
GridOptionForPrinting.gridLineWidth = 0.15;

/// Output options.
export const OutputOption = {
    // only SVG data
    noData: false,
    // for Inkscape use tag
    useXLink: true,
    // show grid number
    gridNumber: false,

    // colorless output
    monochrome: false,
    // background color setting
    setBackground: false,
    backgroundColor: '#ffffff',

    // ?
    strokeWidth: 16,

    // margin from out most grid line to stitches
    leftMargin: 1,
    rightMargin: 1,
    topMargin: 1,
    bottomMargin: 1,

    showTitle: false,
    showCopyright: false,

    lineGrainLineWidth: 16 / 2,
    overGrainLineWidth: 16 / 2,
    overWarpLineWidth: 16 / 2,
    overGrainOffsetRatio: 0.1,
    overWarpOffsetRatio: 0.1,
};

export const OutputOptionForDisplay = Object.assign({}, OutputOption);
OutputOptionForDisplay.setBackground = true;

export const OutputOptionForPrinting = Object.assign({}, OutputOption);
OutputOptionForPrinting.strokeWidth = GridOptionForPrinting.gridWidth / 2;
OutputOptionForPrinting.lineGrainLineWidth = GridOptionForPrinting.gridWidth / 2;
OutputOptionForPrinting.overGrainLineWidth = GridOptionForPrinting.gridWidth / 2;
OutputOptionForPrinting.overWarpLineWidth = GridOptionForPrinting.gridWidth / 2;

export const BoundsOption = {
    useOutputBounds: false,
    boundsLeft: 5,
    boundsRight: 15,
    boundsTop: 5,
    boundsBottom: 15,
};

export const PDFOption = {
    useOutputBounds: false,
    gridNumber: true,
    pageSize: 'A4',
    landscape: false,
    leftMargin: 10,
    rightMargin: 10,
    topMargin: 17,
    bottomMargin: 12,
    multibyteFont: '',
};

export const TemplatesOption = {
    tabOrder: [],
    activeTabId: -1,
    timestamp: 0,
    activeTabIdForPicker: -1,
    nameDownwards: true,
};

export const StorageViewOption = {
    activeIndex: 0,
};

export const StorageOption = {
    storages: [],
};
