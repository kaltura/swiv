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

import { List } from 'immutable';
import { $, SortAction } from 'swiv-plywood';
import { Splits, DataCube, SplitCombine, Colors, Dimension } from '../../models/index';
import { CircumstancesHandler } from '../../utils/circumstances-handler/circumstances-handler';
import { Manifest, Resolve } from '../../models/manifest/manifest';

const DIMENSION_COUNTRY = 'location.country';
const DIMENSION_REGION = 'location.region';
const DIMENSION_CITY = 'location.city';

const GEO_DIMENSIONS: Lookup<boolean> = {
  'location.country': true,
  'location.region': true,
  'location.city': true
};

function getSplitDimensions(splits: Splits, dataCube: DataCube) {
  const dimensions: Dimension[] = splits.toArray().map(
    (split: SplitCombine) => split.getDimension(dataCube.dimensions));
  const geoDims = dimensions.filter((d) => GEO_DIMENSIONS[d.name]);
  const nonGeoDims = dimensions.filter((d) => !GEO_DIMENSIONS[d.name]);
  return { geoDims, nonGeoDims };
}

function getGeoDimensionsLookup(splits: Splits, dataCube: DataCube): Lookup<Dimension> {
  const { geoDims } = getSplitDimensions(splits, dataCube);
  let result: Lookup<Dimension> = {};
  geoDims.forEach((d) => {
    result[d.name] = d;
  });
  return result;
}

function getDefaultSplits(dataCube: DataCube) {
  const defaultSplits = [
    [DIMENSION_COUNTRY],
    [DIMENSION_REGION, DIMENSION_COUNTRY],
    [DIMENSION_CITY, DIMENSION_REGION, DIMENSION_COUNTRY]
  ];

  return defaultSplits.map((splits) => {
    const dimensions = splits.map((dimName) => dataCube.getDimension(dimName));
    return {
      description: `Split on ${dimensions[0].title}`,
      adjustment: {
        splits: new Splits(List(
          dimensions.map((d) =>
            SplitCombine.fromExpression(d.expression))))
      }
    };
  });
}

let handler = CircumstancesHandler.EMPTY()

  // data cube without geo dimensions
  .when((splits: Splits, dataCube: DataCube) => !dataCube.getDimension(DIMENSION_COUNTRY))
  .then(() => Resolve.NEVER)

  // split without geo dimensions
  .when((splits: Splits, dataCube: DataCube) => {
    const { geoDims } = getSplitDimensions(splits, dataCube);
    return !geoDims.length;
  })
  .then((splits: Splits, dataCube: DataCube) => {
    return Resolve.manual(3, 'This visualization requires a geo dimension split',
      getDefaultSplits(dataCube));
  })

  // non-geo dimension splits
  .when((splits: Splits, dataCube: DataCube) => {
    const { nonGeoDims } = getSplitDimensions(splits, dataCube);
    return nonGeoDims.length;
  })
  .then((splits: Splits, dataCube: DataCube) => {
    const { geoDims, nonGeoDims } = getSplitDimensions(splits, dataCube);
    const nonGeoDimsStr = nonGeoDims.map((d) => d.title).join(', ');
    return Resolve.manual(4, 'Non geo splits are not supported',
      [{
        description: `Remove split on ${nonGeoDimsStr}`,
        adjustment: {
          splits: new Splits(List(
            geoDims.map((dimension) =>
              SplitCombine.fromExpression(dimension.expression))))
        }
      }]);
  })

  // city split without region split
  .when((splits: Splits, dataCube: DataCube) => {
    const dimsLookup = getGeoDimensionsLookup(splits, dataCube);
    return dimsLookup[DIMENSION_CITY] && !dimsLookup[DIMENSION_REGION];
  })
  .then((splits: Splits, dataCube: DataCube) => {
    let newDims = [dataCube.getDimension(DIMENSION_REGION)];

    const dimsLookup = getGeoDimensionsLookup(splits, dataCube);
    if (!dimsLookup[DIMENSION_COUNTRY]) {
      newDims.push(dataCube.getDimension(DIMENSION_COUNTRY));
    }

    newDims.forEach((d) => {
      splits = splits.addSplit(SplitCombine.fromExpression(d.expression));
    });

    const dimNames = newDims.map((d) => d.title).join(', ');

    return Resolve.manual(4, 'Must split on region when splitting by city',
      [{
        description: `Add split on ${dimNames}`,
        adjustment: { splits }
      }]);
  })

  // region split without country
  .when((splits: Splits, dataCube: DataCube) => {
    const dimsLookup = getGeoDimensionsLookup(splits, dataCube);
    return dimsLookup[DIMENSION_REGION] && !dimsLookup[DIMENSION_COUNTRY];
  })
  .then((splits: Splits, dataCube: DataCube) => {
    const dimension = dataCube.getDimension(DIMENSION_COUNTRY);
    splits = splits.addSplit(SplitCombine.fromExpression(dimension.expression));

    return Resolve.manual(4, 'Must split on country when splitting by region',
      [{
        description: `Add split on ${dimension.title}`,
        adjustment: { splits }
      }]);
  })

  .otherwise(
    (splits: Splits, dataCube: DataCube, colors: Colors, current: boolean) => {
      let autoChanged = false;

      // TODO: review this
      splits = splits.map((split, i) => {
        const splitDimension = splits.get(0).getDimension(dataCube.dimensions);
        const sortStrategy = splitDimension.sortStrategy;

        if (!split.sortAction) {
          if (sortStrategy) {
            if (sortStrategy === 'self') {
              split = split.changeSortAction(new SortAction({
                expression: $(splitDimension.name),
                direction: SortAction.DESCENDING
              }));
            } else {
              split = split.changeSortAction(new SortAction({
                expression: $(sortStrategy),
                direction: SortAction.DESCENDING
              }));
            }
          } else {
            split = split.changeSortAction(dataCube.getDefaultSortAction());
            autoChanged = true;
          }
        }

        if (!split.limitAction && (autoChanged || splitDimension.kind !== 'time')) {
          split = split.changeLimit(i ? 5 : 50);
          autoChanged = true;
        }

        return split;
      });

      if (colors) {
        colors = null;
        autoChanged = true;
      }

      return autoChanged ? Resolve.automatic(8, { splits }) : Resolve.ready(current ? 10 : 8);
    }
  );


export const GEO_MANIFEST = new Manifest(
  'geo',
  'Geo',
  handler.evaluate.bind(handler),
  'single'
);
