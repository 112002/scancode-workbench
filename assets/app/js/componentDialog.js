/*
 #
 # Copyright (c) 2017 nexB Inc. and others. All rights reserved.
 # https://nexb.com and https://github.com/nexB/scancode-toolkit/
 # The ScanCode software is licensed under the Apache License version 2.0.
 # AboutCode is a trademark of nexB Inc.
 #
 # You may not use this software except in compliance with the License.
 # You may obtain a copy of the License at: http://apache.org/licenses/LICENSE-2.0
 # Unless required by applicable law or agreed to in writing, software distributed
 # under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
 # CONDITIONS OF ANY KIND, either express or implied. See the License for the
 # specific language governing permissions and limitations under the License.
 #
 */

class ComponentDialog {
    constructor(dialogId, aboutCodeDB) {
        this.aboutCodeDB = aboutCodeDB;

        // Define DOM element constants for the modal dialog.
        // TODO: Use nested ids to avoid collisions, e.g. #nodeModal .nodeModalLabel
        this.dialog = $("#componentDialog");
        this.title = this.dialog.find(".modal-title");
        this.status = this.dialog.find("#component-status");
        this.name = this.dialog.find("#component-name");
        this.license = this.dialog.find("#component-license");
        this.owner = this.dialog.find("#component-owner");
        this.copyright = this.dialog.find("#component-copyright");
        this.deployed = this.dialog.find("input[name=component-deployed]");
        this.modified = this.dialog.find("input[name=component-modified]");
        this.codeType = this.dialog.find("#component-code-type");
        this.notes = this.dialog.find("#component-notes");
        this.feature = this.dialog.find("#component-feature");
        this.purpose = this.dialog.find("#component-purpose");
        this.language = this.dialog.find("#component-language");
        this.version = this.dialog.find("#component-version");
        this.homepageUrl = this.dialog.find("#component-homepage-url");
        this.downloadUrl = this.dialog.find("#component-download-url");
        this.licenseUrl = this.dialog.find("#component-license-url");
        this.noticeUrl = this.dialog.find("#component-notice-url");
        this.saveButton = this.dialog.find("button#component-save");
        this.deleteButton = this.dialog.find("button#component-delete");

        // Define the buttons that can be used to close the dialog.
        this.exitButton = this.dialog.find("button#component-exit");
        this.closeButton = this.dialog.find("button#component-close");

        // Make node view modal box draggable
        this.dialog.draggable({ handle: ".modal-header" });
        this.handlers = {};
        this.saveButton.click(() => this._saveComponent());
        this.deleteButton.click(() => this._deleteComponent());

        // Link each close button's click event to a method that checks for unsaved edits.
        this.exitButton.click(() => this._closeComponent());
        this.closeButton.click(() => this._closeComponent());
    }

    database(aboutCodeDB) {
        this.aboutCodeDB = aboutCodeDB;
    }

    on(event, handler) {
        this.handlers[event] = handler;
        return this;
    }

    // Check whether the user has made any new edits.
    _closeComponent() {
        // Retrieve the current form values, i.e., including edits not yet saved.
        this.currentSerialization = this.dialog.find("form").serialize();

        if (this.initialSerialization !== this.currentSerialization) {
            return confirm('Your new changes haven\'t been saved.  \n\n' +
                'Are you sure you want to exit without saving?');
        }
    }

    _saveComponent() {
        let path = this.title.text();
        this._component(path)
            .then(component => {
                // Set the file id on the component.
                return this.aboutCodeDB.File
                    .findOne({
                        attributes: ["id"],
                        where: { path: { $eq: path } }
                    })
                    .then(row => {
                        component.fileId = row.id;
                        return component;
                    });
            })
            .then(component => {
                const modifiedValue = $("input[name=component-modified]:checked").val();
                const deployedValue = $("input[name=component-deployed]:checked").val();

                return {
                    path: path,
                    fileId: component.fileId,
                    review_status: this.status.val(),
                    name: this.name.val(),
                    licenses: $.map(this.license.val() || [], license => {
                        return { key: license };
                    }),
                    copyrights: $.map(this.copyright.val() || [], copyright => {
                        return { statements: copyright.split("\n") };
                    }),
                    code_type: (this.codeType.val() || [null])[0],
                    is_modified: modifiedValue ? (modifiedValue === "yes") : null,
                    is_deployed: deployedValue ? (deployedValue === "yes") : null,
                    version: this.version.val(),
                    owner: (this.owner.val() || [null])[0],
                    feature: this.feature.val(),
                    purpose: this.purpose.val(),
                    homepage_url: (this.homepageUrl.val() || [null])[0],
                    download_url: (this.downloadUrl.val() || [null])[0],
                    license_url: (this.licenseUrl.val() || [null])[0],
                    notice_url: (this.noticeUrl.val() || [null])[0],
                    programming_language: (this.language.val() || [null])[0],
                    notes: this.notes.val()
                };
            })
            .then(component => this.aboutCodeDB.setComponent(component))
            .then(component => this.handlers.save(component));
        this.dialog.modal('hide');
    }

    // Delete a created Component inside the Component Modal
    _deleteComponent() {
        let id = this.title.text();
        this.aboutCodeDB.findComponent({ where: { path: id }})
            .then(component => {
                if (component !== null) {
                    return component.destroy()
                        .then(() => this.handlers.delete(component));
                }
            });
    }

    // Populate modal input fields with suggestions from ScanCode results
    show(path) {
        this._component(path)
            .then(component => {
                this.title.text(path);
                return Promise.all([
                    this._setupStatus(component),
                    this._setupName(component),
                    this._setupVersion(component),
                    this._setupLicenses(component),
                    this._setupCopyrights(component),
                    this._setupOwners(component),
                    this._setupLanguage(component),
                    this._setupHomepageUrl(component),
                    this._setupFeature(component),
                    this._setupPurpose(component),
                    this._setupCodeType(component),
                    this._setupModified(component),
                    this._setupDeployed(component),
                    this._setupDownloadUrl(component),
                    this._setupLicenseUrl(component),
                    this._setupNoticeUrl(component),
                    this._setupNotes(component)
                ]);
            })
            .then(() => {
                // Notify only select2 of changes
                $('select').trigger('change.select2');

                // Disable the ability to close the dialog by clicking outside
                // the dialog or pressing the escape key.
                this.dialog.modal({ backdrop: "static", keyboard: false });

                // Retrieve any previously-saved values -- use below in _closeComponent()
                // to compare with any new edits before closing the dialog.
                this.initialSerialization = this.dialog.find("form").serialize();

                this.dialog.modal('show');
            });
    }

    _component(path) {
        return this.aboutCodeDB
            .findComponent({ where: { path: path } })
            .then(component => component ? component : {});
    }

    _setupLicenses(component) {
        const saved = (component.licenses || []).map(license => license.key);
        return this.aboutCodeDB.db
            .then(() => {
                return this.aboutCodeDB.File
                    .findAll({
                        attributes: [],
                        group: ['licenses.key'],
                        where: { path: {$like: `${component.path}%`}},
                        include: [{
                            model: this.aboutCodeDB.License,
                            attributes: ['key'],
                            where: {key: {$ne: null}}
                        }]
                    });
            })
            .then(rows => $.map(rows, row => row.licenses))
            .then(licenses => $.map(licenses, (license, i) => license.key))
            .then(license_keys => license_keys.concat(saved))
            .then(license_keys => {
                this.license.html('').select2({
                    data: $.unique(license_keys),
                    multiple: true,
                    placeholder: "Enter license",
                    tags: true
                }, true);
                this.license.val(saved);
            });
    }

    _setupCopyrights(component) {
        const saved = $.map((component.copyrights || []), copyright => {
            return copyright.statements;
        });
        return this.aboutCodeDB.db
            .then(() => {
                return this.aboutCodeDB
                    .File.findAll({
                        attributes: [],
                        group: ['copyrights.statements'],
                        where: {path: {$like: `${component.path}%`}},
                        include: [{
                            model: this.aboutCodeDB.Copyright,
                            attributes: ['statements'],
                            where: {statements: {$ne: null}}
                        }]
                    });
            })
            .then(rows => $.map(rows, row => row.copyrights))
            .then(copyrights => $.map(copyrights, copyright => copyright.statements))
            .then(copyright_statements => copyright_statements.concat(saved))
            .then(copyright_statements => {
                this.copyright.html('').select2({
                    data: $.unique(copyright_statements),
                    multiple: true,
                    placeholder: "Enter copyright",
                    tags: true
                }, true);
                this.copyright.val(saved);
            });
    }

    _setupOwners(component) {
        const saved = component.owner || [];
        return this.aboutCodeDB.db
            .then(() => {
                return this.aboutCodeDB
                    .File.findAll({
                        attributes: [],
                        group: ['copyrights.holders'],
                        where: {path: {$like: `${component.path}%`}},
                        include: [{
                            model: this.aboutCodeDB.Copyright,
                            attributes: ['holders'],
                            where: {holders: {$ne: null}}
                        }]
                    });
            })
            .then(rows => $.map(rows, row => row.copyrights))
            .then(copyrights => $.map(copyrights, copyright => copyright.holders))
            .then(owners => owners.concat(saved))
            .then(owners => {
                this.owner.html('').select2({
                    data: $.unique(owners),
                    multiple: true,
                    maximumSelectionLength: 1,
                    placeholder: "Enter owner",
                    tags: true
                }, true);
                this.owner.val(saved);
            });
    }

    _setupLanguage(component) {
        const saved = component.programming_language || [];
        return this.aboutCodeDB.db
            .then(() => {
                return this.aboutCodeDB
                    .File.findAll({
                        attributes: ["programming_language"],
                        group: ['programming_language'],
                        where: {
                            path: {$like: `${component.path}%`},
                            programming_language: {$ne: null}
                        }
                    });
            })
            .then(rows => $.map(rows, row => row.programming_language))
            .then(languages => languages.concat(saved))
            .then(languages => {
                this.language.html('').select2({
                    data: $.unique(languages),
                    multiple: true,
                    maximumSelectionLength: 1,
                    placeholder: "Enter language",
                    tags: true
                }, true);
                this.language.val(saved);
            });
    }

    _setupCodeType(component) {
        const saved = component.code_type || [];
        this.codeType.html('').select2({
            data: [saved],
            multiple: true,
            maximumSelectionLength: 1,
            placeholder: "Enter code type",
            tags: true
        }, true);
        this.codeType.val(saved);
    }

    _setupHomepageUrl(component) {
        const saved = component.homepage_url || [];
        return this.aboutCodeDB.db
            .then(() => {
                return this.aboutCodeDB
                    .File.findAll({
                        attributes: [],
                        group: ['urls.url'],
                        where: {path: {$like: `${component.path}%`}},
                        include: [{
                            model: this.aboutCodeDB.Url,
                            attributes: ['url'],
                            where: {url: {$ne: null}}
                        }]
                    });
            })
            .then(rows => $.map(rows, row => row.urls))
            .then(urls => $.map(urls, url => url.url))
            .then(homepage_urls => homepage_urls.concat(saved))
            .then(homepage_urls => {
                this.homepageUrl.html('').select2({
                    data: $.unique(homepage_urls),
                    multiple: true,
                    maximumSelectionLength: 1,
                    placeholder: "Enter Homepage URL",
                    tags: true
                }, true);
                this.homepageUrl.val(saved);
            });
    }

    _setupDownloadUrl(component) {
        const saved = component.download_url || [];
        this.downloadUrl.html('').select2({
            data: [saved],
            multiple: true,
            maximumSelectionLength: 1,
            placeholder: "Enter Download URL",
            tags: true
        }, true);
        this.downloadUrl.val(saved);
    }

    _setupLicenseUrl(component) {
        const saved = component.license_url || [];
        this.licenseUrl.html('').select2({
            data: [saved],
            multiple: true,
            maximumSelectionLength: 1,
            placeholder: "Enter License URL",
            tags: true
        }, true);
        this.licenseUrl.val(saved);
    }

    _setupNoticeUrl(component) {
        const saved = component.notice_url || [];
        this.noticeUrl.html('').select2({
            data: [saved],
            multiple: true,
            maximumSelectionLength: 1,
            placeholder: "Enter Notice URL",
            tags: true
        }, true);
        this.noticeUrl.val(saved);
    }

    _setupModified(component) {
        if (component.is_modified !== null && component.is_modified !== undefined) {
            const modifiedValue = component.is_modified ? 'yes' : 'no';
            $(`input[name=component-modified][value='${modifiedValue}']`)
                .prop("checked", true);
        } else {
            this.modified.prop("checked", false);
        }
    }

    _setupDeployed(component) {
        if (component.is_deployed !== null && component.is_deployed !== undefined) {
            const deployedValue = component.is_deployed ? 'yes' : 'no';
            $(`input[name=component-deployed][value='${deployedValue}']`)
                .prop("checked", true);
        } else {
            this.deployed.prop("checked", false);
        }
    }

    _setupStatus(component) {
        this.status.val(component.review_status || "");
    }

    _setupName(component) {
        this.name.val(component.name || "");
    }

    _setupVersion(component) {
        this.version.val(component.version || "");
    }

    _setupFeature(component) {
        this.feature.val(component.feature || "");
    }

    _setupPurpose(component) {
        this.purpose.val(component.purpose || "");
    }

    _setupNotes(component) {
        this.notes.val(component.notes || "");
    }
}

module.exports = ComponentDialog;