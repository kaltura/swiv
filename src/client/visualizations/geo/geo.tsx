/*
 * Copyright 2015-2016 Imply Data, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

require('./geo.css');

import { List } from 'immutable';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { r, Dataset, Datum, PseudoDatum, TimeRange, Set } from 'swiv-plywood';
import { VisualizationProps, Essence, Measure, Splits, DataCube, Filter, FilterClause } from '../../../common/models/index';
import { DatasetLoad } from '../../../common/models/index';
import { GEO_MANIFEST } from '../../../common/manifests/geo/geo';
import { getXFromEvent, getYFromEvent } from '../../utils/dom/dom';
import { SegmentBubble } from '../../components/segment-bubble/segment-bubble';

import { BaseVisualization, BaseVisualizationState } from '../base-visualization/base-visualization';

import 'leaflet/dist/leaflet.css';
import * as L from 'leaflet';
import { Map, FeatureGroup, LatLng, DivIcon, Marker, Point } from 'leaflet';

const ICON_COLOR_LEVELS = 20;
const ICON_SIZES = [8, 6, 4, 3, 2];
const MAX_MARKERS = 1000;
const LEVEL_TO_ZINDEX_FACTOR = 200;

const LOW_COLOR = [255, 224, 0];    // yellow
const HIGH_COLOR = [196, 0, 0];     // red

interface GeoDatum extends Datum {
  coords: string;
  coordsName: string;
  lat: number;
  long: number;
}

export interface GeoState extends BaseVisualizationState {
  flatData?: PseudoDatum[];
  hoverDatum?: PseudoDatum;

  containerYPosition?: number;
  containerXPosition?: number;
}

function getFilterFromDatum(splits: Splits, flatDatum: PseudoDatum, dataCube: DataCube): Filter {
  if (flatDatum['__nest'] === 0) return null;
  let segments: any[] = [];
  while (flatDatum['__nest'] > 0) {
    segments.unshift(flatDatum[splits.get(flatDatum['__nest'] - 1).getDimension(dataCube.dimensions).name]);
    flatDatum = flatDatum['__parent'];
  }
  return new Filter(List(segments.map((segment, i) => {
    return new FilterClause({
      expression: splits.get(i).expression,
      selection: r(TimeRange.isTimeRange(segment) ? segment : Set.fromJS([segment]))
    });
  })));
}

export class Geo extends BaseVisualization<GeoState> {
  public static id = GEO_MANIFEST.name;
  protected _map: Map;
  protected _iconCache: Lookup<DivIcon>;
  protected _iconColorLevels: Array<number>;
  protected _markers: FeatureGroup;
  protected _markersIconSize: number;
  protected _fitBounds: boolean;

  constructor() {
    super();

    this._iconCache = {};
    this._iconColorLevels = [];
    for (let i = ICON_COLOR_LEVELS; i >= 0; i--) {
      this._iconColorLevels.push(i);
    }
  }

  getIconColor(colorLevel: number, selected: boolean): Lookup<string> {
    let color: number[] = [];

    for (let j = 0; j < 3; j++) {
      let colorVal = (LOW_COLOR[j] * (ICON_COLOR_LEVELS - colorLevel) +
         HIGH_COLOR[j] * colorLevel) / ICON_COLOR_LEVELS;
      if (!selected) {
        colorVal = (255 + colorVal) / 2;
      }
      color.push(Math.floor(colorVal));
    }

    const fillColor = 'rgb(' + color.join() + ')';
    const borderColor = 'rgb(' + color.map((v) => Math.floor(v * .8)).join() + ')';
    return { fillColor, borderColor };
  }

  getIcon(size: number, colorLevel: number, selected: boolean) {
    // try to get from cache
    const key = `${size}-${colorLevel}-${selected}`;
    if (this._iconCache[key]) {
      return this._iconCache[key];
    }

    const { fillColor, borderColor } = this.getIconColor(colorLevel, selected);

    const iconHtml = `
      <svg style="width: ${2 * size}px;height: ${2 * size}px;">
        <circle cx="${size}" cy="${size}" r="${size - .5}" stroke="${borderColor}" fill="${fillColor}" />
      </svg>`;

    const icon = L.divIcon({
      html: iconHtml,
      className: 'geo-marker-icon',
      iconSize: [size * 2, size * 2],
      iconAnchor: [size, size]
    });

    this._iconCache[key] = icon;
    return icon;
  }

  getDefaultState(): GeoState {
    let s = super.getDefaultState() as GeoState;

    s.flatData = null;
    s.hoverDatum = null;

    return s;
  }

  componentDidUpdate() {
    const { containerYPosition, containerXPosition } = this.state;

    const node = ReactDOM.findDOMNode(this.refs['container']);
    if (!node) {
      return;
    }

    const rect = node.getBoundingClientRect();

    if (containerYPosition !== rect.top || containerXPosition !== rect.left) {
      this.setState({
        containerYPosition: rect.top,
        containerXPosition: rect.left
      });
    }
  }

  componentWillReceiveProps(nextProps: VisualizationProps) {
    super.componentWillReceiveProps(nextProps);

    const { essence, timekeeper } = this.props;
    const nextEssence = nextProps.essence;

    if (essence.differentFilter(nextEssence)) {
      this._fitBounds = true;
    }
  }

  componentDidMount() {
    this._fitBounds = true;
    this._map = L.map('mapid').setView([0, 0], 1)
      .on('zoom', (e: any) => { this.onMapZoomChanged(); })
      .on('zoomstart', (e: any) => { this.onMapZoomMoveStart(); })
      .on('movestart', (e: any) => { this.onMapZoomMoveStart(); });

    L.tileLayer('https://cf3.kaltura.com/content/static/maps/v1/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="http://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors',
      minZoom: 1,
      maxZoom: 11,
      id: 'mapbox.streets'
    }).addTo(this._map);

    super.componentDidMount();
  }

  getBestIconSize(): number {
    const { flatData } = this.state;

    // get the marker positions
    let positions: Point[] = [];
    flatData.forEach((d) => {
      const gd = d as GeoDatum;
      const pos = this._map.latLngToLayerPoint([gd.lat, gd.long]).round();
      positions.push(pos);
    });

    if (positions.length < 3) {
      return ICON_SIZES[0];
    }

    // divide into 20x20 blocks, count the number of markers in each block
    const bounds = L.bounds(positions);
    const blockSize = (Math.max(bounds.max.x - bounds.min.x, bounds.max.y - bounds.min.y) + 1) / 20;
    let blockCount: Lookup<number> = {};

    positions.forEach((pos) => {
      const blockIndexx = Math.floor((pos.x - bounds.min.x) / blockSize);
      const blockIndexy = Math.floor((pos.y - bounds.min.y) / blockSize);
      const blockIndex = blockIndexx + '_' + blockIndexy;

      if (!blockCount[blockIndex]) {
        blockCount[blockIndex] = 1;
      } else {
        blockCount[blockIndex]++;
      }
    });

    // calculate the target size
    let maxCount = 0;
    for (let blockIndex in blockCount) {
      maxCount = Math.max(maxCount, blockCount[blockIndex]);
    }
    const targetSize = blockSize / Math.sqrt(maxCount) / 4;

    // find the size closest to target
    let bestSize = ICON_SIZES[0];
    ICON_SIZES.forEach((size) => {
      if (Math.abs(targetSize - size) < Math.abs(targetSize - bestSize)) {
        bestSize = size;
      }
    });

    return bestSize;
  }

  calculateMousePosition(x: number, y: number): PseudoDatum {
    const { flatData } = this.state;
    const { essence } = this.props;

    let result: PseudoDatum = null;
    let resultValue: number;

    const measuresArray = essence.getEffectiveMeasures().toArray();
    let threshold = Math.max(this._markersIconSize, 5);
    threshold = threshold * threshold;
    measuresArray.forEach((measure, i) => {
      flatData.forEach((d) => {
        const gd = d as GeoDatum;
        const pos = this._map.latLngToContainerPoint([gd.lat, gd.long]).round();
        if ((pos.x - x) * (pos.x - x) + (pos.y - y) * (pos.y - y) > threshold) {
          return;
        }

        const measureValue = d[measure.name] as number;
        if (result && measureValue < resultValue) {
          return;
        }
        result = d;
        resultValue = measureValue;
      });
    });
    return result;
  }

  getRelativeMouseCoordinates(event: MouseEvent): {x: number, y: number} {
    const { containerYPosition, containerXPosition } = this.state;

    const x = getXFromEvent(event) - containerXPosition;
    const y = getYFromEvent(event) - containerYPosition;
    return {x, y};
  }

  onMouseClick(event: MouseEvent) {
    const { x, y } = this.getRelativeMouseCoordinates(event);
    const d = this.calculateMousePosition(x, y);
    if (!d) {
      return;
    }

    this.onClick(d);
  }

  onMouseMove(event: MouseEvent) {
    const { x, y } = this.getRelativeMouseCoordinates(event);
    const { hoverDatum } = this.state;
    const d = this.calculateMousePosition(x, y);
    if (d !== hoverDatum) {
      this.setState({hoverDatum: d});
    }
  }

  onMapZoomMoveStart() {
    const { clicker, essence } = this.props;

    if (essence.highlightOn(Geo.id)) {
      clicker.dropHighlight();
    }

    const { hoverDatum } = this.state;
    if (hoverDatum) {
      this.setState({hoverDatum: null});
    }
  }

  updateMarkerIcons(iconSize: number) {
    this._markers.eachLayer((layer) => {
      const marker = layer as Marker;
      const colorLevel = marker.options.zIndexOffset / LEVEL_TO_ZINDEX_FACTOR;
      marker.setIcon(this.getIcon(iconSize, colorLevel, true));
    });
    this._markersIconSize = iconSize;
  }

  onMapZoomChanged() {
    const iconSize = this.getBestIconSize();

    if (iconSize !== this._markersIconSize && this._markers) {
      this.updateMarkerIcons(iconSize);
    }
  }

  precalculate(props: VisualizationProps, datasetLoad: DatasetLoad = null) {
    const { essence } = props;
    const { splits } = essence;

    const existingDatasetLoad = this.state.datasetLoad;
    let newState: GeoState = {};
    if (datasetLoad) {
      // always keep the old dataset while loading
      if (datasetLoad.loading) {
        datasetLoad.dataset = existingDatasetLoad.dataset;
      }

      newState.datasetLoad = datasetLoad;
    } else {
      datasetLoad = this.state.datasetLoad;
    }

    const { dataset } = datasetLoad;

    if (dataset && splits.length()) {
      const splitLength = splits.length();

      // flatten and take only data with coordinates
      let flatData = dataset.flatten({
        order: 'preorder',
        nestingName: '__nest',
        parentName: '__parent'
      }).filter((d: Datum) => d['__nest'] === splitLength && (d as GeoDatum).coords);

      // parse the coordinates
      flatData.forEach((d) => {
        const gd = d as GeoDatum;
        // TODO: can put this on GeoDatum?
        let coordsStr = gd.coords;
        const delimPos = coordsStr.indexOf(' ');
        gd.coordsName = '';
        if (delimPos >= 0) {
          gd.coordsName = coordsStr.substring(delimPos + 1);
          coordsStr = coordsStr.substring(0, delimPos);
        }
        const parsedCoords = coordsStr.split('/').map(parseFloat);
        gd.lat = parsedCoords[0];
        gd.long = parsedCoords[1];
      });

      newState.flatData = flatData.slice(0, MAX_MARKERS);   // limit the number of markers for performance reasons
    }

    this.setState(newState);
  }

  getScalesForMarkers(essence: Essence, flatData: PseudoDatum[]): d3.scale.Quantize<number>[] {
    const measuresArray = essence.getEffectiveMeasures().toArray();

    return measuresArray.map(measure => {
      let measureValues = flatData
        .map((d: Datum) => d[measure.name] as number);

      // Ensure that 0 is in there
      measureValues.push(0);

      return d3.scale.quantize<number>()
        .domain(measureValues)
        .range(this._iconColorLevels);
    });
  }

  onClick(datum: Datum) {
    const { clicker, essence } = this.props;
    const { splits, dataCube } = essence;

    if (!clicker.dropHighlight || !clicker.changeHighlight) {
      return;
    }

    const rowHighlight = getFilterFromDatum(splits, datum, dataCube);

    if (!rowHighlight) {
      return;
    }

    if (essence.highlightOn(Geo.id) && rowHighlight.equals(essence.highlight.delta)) {
      // this item is already selected, remove the selection
      clicker.dropHighlight();
      return;
    }

    clicker.changeHighlight(Geo.id, null, rowHighlight);
  }

  isSelected(datum: PseudoDatum): boolean {
    const { essence } = this.props;
    const { splits, dataCube } = essence;

    if (essence.highlightOn(Geo.id)) {
      return essence.highlight.delta.equals(getFilterFromDatum(splits, datum, dataCube));
    }

    return false;
  }

  isHovered(datum: PseudoDatum): boolean {
    const { essence } = this.props;
    const { hoverDatum } = this.state;
    const { splits, dataCube } = essence;

    if (essence.highlightOn(Geo.id)) {
      return false;
    }
    if (!hoverDatum) {
      return false;
    }

    const filter = (p: PseudoDatum) => getFilterFromDatum(splits, p, dataCube);

    return filter(hoverDatum).equals(filter(datum));
  }

  renderInternals() {
    const { flatData, containerXPosition, containerYPosition } = this.state;
    const { essence, clicker, openRawDataModal, stage } = this.props;
    const { splits, dataCube } = essence;

    let highlightBubble: JSX.Element = null;
    let hoverBubble: JSX.Element = null;

    if (this._map) {
      if (this._markers) {
        this._markers.clearLayers();
      } else {
        this._markers = L.featureGroup([]);
        this._map.addLayer(this._markers);
      }

      if (flatData) {
        // TODO: skip marker creation if nothing changed

        const hScales = this.getScalesForMarkers(essence, flatData);

        const measuresArray = essence.getEffectiveMeasures().toArray();

        const iconSize = this.getBestIconSize();
        this._markersIconSize = iconSize;

        let highlightDelta: Filter = null;
        if (essence.highlightOn(Geo.id)) {
          highlightDelta = essence.highlight.delta;
        }

        measuresArray.forEach((measure, i) => {
          flatData.forEach((d) => {
            const gd = d as GeoDatum;
            const measureValue = d[measure.name] as number;
            const colorLevel = hScales[i](measureValue);
            const selected = highlightDelta && this.isSelected(d);

            const icon = this.getIcon(iconSize, colorLevel, !highlightDelta || selected);
            const zIndexOffset = colorLevel * LEVEL_TO_ZINDEX_FACTOR;
            const marker = L.marker([gd.lat, gd.long], { icon, zIndexOffset }).addTo(this._map);
            this._markers.addLayer(marker);

            if (selected) {
              const pos = this._map.latLngToContainerPoint([gd.lat, gd.long]).round();
              const nest = d['__nest'];

			  // Note: in case of reverse order (region, country) dimension will be the country
			  //       while it makes more sense to use the region. this only affects 'go to url',
			  //       so have no significance at this point.
              const dimension = dataCube.getDimensionByExpression(splits.splitCombines.get(nest - 1).expression);

              highlightBubble = <SegmentBubble
                left={containerXPosition + pos.x}
                top={containerYPosition + pos.y}
                segmentLabel={gd.coordsName}
                measureLabel={measure.formatDatum(d)}
                dimension={dimension}
                clicker={clicker}
                openRawDataModal={openRawDataModal}
              />;
            }

            if (this.isHovered(d)) {
              const pos = this._map.latLngToContainerPoint([gd.lat, gd.long]).round();

              hoverBubble = <SegmentBubble
                left={containerXPosition + pos.x}
                top={containerYPosition + pos.y}
                segmentLabel={gd.coordsName}
                measureLabel={measure.formatDatum(d)}
              />;
            }
          });
        });

        const markersCount = this._markers.getLayers().length;
        if (this._fitBounds && markersCount > 0) {
          this._fitBounds = false;

          const bounds = this._markers.getBounds();
          if (markersCount === 1) {
            this._map.setView(bounds.getCenter(), 3);
          } else {
            this._map.fitBounds(bounds);
          }
        }
      }
    }

    return <div className="internals">
       <div
        className="geo-container"
        id="mapid"
        ref="container"

        onMouseMove={this.onMouseMove.bind(this)}
        onClick={this.onMouseClick.bind(this)}>
       </div>
       {highlightBubble}
       {hoverBubble}
    </div>;
  }
}
