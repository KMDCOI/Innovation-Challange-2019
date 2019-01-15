/* global JSZip:true */
sap.ui.define([
	"sap/ui/core/mvc/Controller",
	"sap/m/MessageBox"
], function (Controller, MessageBox) {
	"use strict";
	return Controller.extend("sapui5ml.controller.img_class", {
		fileTypeMissmatch: function (oControlEvent) {
			MessageBox.show("Wrong file type!");
		},
		clearPredictions: function () {
			this.getView().getModel("img_class").setProperty("/predictions", null);
			this.getView().getModel("img_class").setProperty("/visible", false);
		},
		addPrediction: function (prediction) {
			var current = this.getView().getModel("img_class").getProperty("/predictions");
			if (!current) {
				current = [];
			}
			current.push(prediction);
			// add the results from the model
			this.getView().getModel("img_class").setProperty("/predictions", current);
			this.getView().getModel("img_class").setProperty("/visible", true);
		},
		displayErrorsOrFinish: function (oController) {
			if (oController.oFilesProcessed === oController.oFiles.length) {
				oController.oBusyIndicator.close();
				if (oController.oErrors.length === 0) {
					MessageBox.show("Process completed!\n Target URL: " + oController.getView().getModel("img_class").getProperty("/url"));
				} else {
					var message = "";
					for (var i = 0; i < oController.oErrors.length; i++) {
						message += "\n\t  Error: " + oController.oErrors[i].status + " - " + oController.oErrors[i].message;
					}
					MessageBox.show("Errors: \n" + message);
				}
			}
		},
		getFileContentUrl: function (files, prediction, callback) {
			for (var i = 0; i < files.length; i++) {
				if (files[i].type.match("image.*")) {
					if (files[i].name === prediction.name) {
						callback(prediction, files[i].contentUrl);
					}
				} else {
					JSZip.loadAsync(files[i]).then(function (zip) {
						Object.keys(zip.files).forEach(function (zipEntry) {
							if (zipEntry === prediction.name) {
								zip.files[zipEntry].async("blob").then(function (zipEntryFile) {
									callback(prediction, URL.createObjectURL(zipEntryFile));
								});
							}
						});
					});
				}
			}
		},
		fileUploaderChange: function (oControlEvent) {
			// start the busy indicator
			var oBusyIndicator = new sap.m.BusyDialog();
			oBusyIndicator.open();

			// clear previous results from the model
			this.clearPredictions();

			// keep a reference of the uploaded file name and create the local url
			var oFiles = oControlEvent.getParameters().files;
			for (var i = 0; i < oFiles.length; i++) {
				oFiles[i].contentUrl = URL.createObjectURL(oFiles[i]);
			}
			// keep a reference in the view to close it later
			this.oBusyIndicator = oBusyIndicator;
			this.oFiles = Object.assign({}, oFiles);
			this.oFiles.length = oFiles.length;
			this.oFilesProcessed = 0;
			this.oErrors = [];
		},
		fileUploaderComplete: function (oControlEvent) {
			var response = JSON.parse(oControlEvent.getParameters().responseRaw);
			this.processResults(this, response);
		},
		processResults: function (oController, response) {
			oController.oFilesProcessed++;
			if (response.status === "DONE") {
				for (var i = 0; i < response.predictions.length; i++) {
					var callback = function (prediction, contentUrl) {
						prediction.contentUrl = contentUrl;
						oController.addPrediction(prediction);
					};
					oController.getFileContentUrl(oController.oFiles, response.predictions[i], callback);
				}
			} else {
				oController.oErrors.push({
					"status": response.error.code,
					"message": response.error.message
				});
			}
			oController.displayErrorsOrFinish(oController);
		}

	});
});

