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

import * as filesaver from 'browser-filesaver';
import { Dataset } from 'swiv-plywood';

export type FileFormat = "csv" | "tsv" | "json" | "txt";

export function getMIMEType(fileType: string) {
  switch (fileType) {
    case 'csv':
      return 'text/csv';
    case 'tsv':
      return 'text/tsv';
    default:
      return 'application/json';
  }
}

export function download(dataset: Dataset, fileName?: string, fileFormat?: FileFormat): void {
  const type = `${getMIMEType(fileFormat)};charset=utf-8`;
  const blob = new Blob([datasetToFileString(dataset, fileFormat)], {type});
  if (!fileName) fileName = `${new Date()}-data`;
  fileName += `.${fileFormat}`;
  filesaver.saveAs(blob, fileName, true); // true == disable auto BOM
}

function _getInputElementForCopy(text: string): HTMLInputElement {
  // Create an element off screen.
  let element = <HTMLInputElement>document.getElementById('copyToClipboardInput');
  if (typeof element === 'undefined' || element === null) {
    element = <HTMLInputElement>document.createElement('TEXTAREA');
    element.setAttribute('id', 'copyToClipboardInput');
    element.setAttribute('style', 'position: absolute; left: -9999px; top: -9999px;');
    element.setAttribute('aria-hidden', 'true');
    element.setAttribute('tabindex', '-1');
  }
  // Add the input value to the temp element.
  element.value = text;
  document.body.appendChild(element);
  return element;
}

function _copyElement(el: HTMLInputElement): 'success' | 'failure' {
  try {
    if ((<any>document.body)['createTextRange']) {
      // IE
      const textRange = (<any>document.body)['createTextRange']();
      textRange.moveToElementText(el);
      textRange.select();
      textRange.execCommand('Copy');
      return 'success';
    } else if (window.getSelection && document.createRange) {
      // non-IE
      const editable = el.contentEditable; // Record contentEditable status of element
      const readOnly = el.readOnly; // Record readOnly status of element
      el.contentEditable = 'true'; // iOS will only select text on non-form elements if contentEditable = 'true'
      el.readOnly = false; // iOS will not select in a read only form element
      const range = document.createRange();
      range.selectNodeContents(el);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range); // Does not work for Firefox if a textarea or input
      if (el.nodeName === 'TEXTAREA' || el.nodeName === 'INPUT') {
        el.select(); // Firefox will only select a form element with select()
      }
      if (el.setSelectionRange && navigator.userAgent.match(/ipad|ipod|iphone/i)) {
        el.setSelectionRange(0, 999999); // iOS only selects "form" elements with SelectionRange
      }
      el.contentEditable = editable; // Restore previous contentEditable status
      el.readOnly = readOnly; // Restore previous readOnly status
      if (document.queryCommandSupported('copy')) {
        document.execCommand('copy');
        return 'success';
      }
    }
    return 'failure';
  } catch (err) {
    return 'failure';
  }
}

export function copyTable(dataset: Dataset, fileFormat?: FileFormat): void {
  const data = datasetToFileString(dataset, fileFormat);

  const elementToCopy: HTMLInputElement = _getInputElementForCopy(data);
  _copyElement(elementToCopy);
  document.body.removeChild(elementToCopy);
}

export function datasetToFileString(dataset: Dataset, fileFormat?: FileFormat): string {
  if (fileFormat === 'csv') {
    return dataset.toCSV();
  } else if (fileFormat === 'tsv') {
    return dataset.toTSV();
  } else {
    return JSON.stringify(dataset.toJS(), null, 2);
  }
}

export function makeFileName(...args: Array<string>): string {
  var nameComponents: string[] = [];
  args.forEach((arg) => {
    if (arg) nameComponents.push(arg.toLowerCase());
  });
  var nameString = nameComponents.join("_");
  return nameString.length < 200 ? nameString : nameString.substr(0, 200);
}

