/*
 * Copyright (c) 2015 Memorial Sloan-Kettering Cancer Center.
 *
 * This library is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY, WITHOUT EVEN THE IMPLIED WARRANTY OF MERCHANTABILITY OR FITNESS
 * FOR A PARTICULAR PURPOSE. The software and documentation provided hereunder
 * is on an "as is" basis, and Memorial Sloan-Kettering Cancer Center has no
 * obligations to provide maintenance, support, updates, enhancements or
 * modifications. In no event shall Memorial Sloan-Kettering Cancer Center be
 * liable to any party for direct, indirect, special, incidental or
 * consequential damages, including lost profits, arising out of the use of this
 * software and its documentation, even if Memorial Sloan-Kettering Cancer
 * Center has been advised of the possibility of such damage.
 */

/*
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

/**
 * Default mutation view for a single gene.
 *
 * options: {el: [target container],
 *           model: {geneSymbol: [hugo gene symbol],
 *                   mutationData: [mutation data for a specific gene]
 *                   dataProxies: [all available data proxies],
 *                   sequence: [PFAM sequence data],
 *                   sampleArray: [list of case ids as an array of strings],
 *                   diagramOpts: [mutation diagram options -- optional],
 *                   tableOpts: [mutation table options -- optional]}
 *          }
 *
 * @author Selcuk Onur Sumer
 */
var MainMutationView = Backbone.View.extend({
	initialize : function (options) {
		this.options = options || {};

		// custom event dispatcher
		this.dispatcher = {};
		_.extend(this.dispatcher, Backbone.Events);
	},
	render: function() {
		var self = this;

		// pass variables in using Underscore.js template
		var variables = {geneSymbol: self.model.geneSymbol,
			mutationSummary: self._mutationSummary(),
			uniprotId: self.model.sequence.metadata.identifier};

		// compile the template using underscore
		var templateFn = BackboneTemplateCache.getTemplateFn("mutation_view_template");
		var template = templateFn(variables);

		// load the compiled HTML into the Backbone "el"
		self.$el.html(template);

		// format after rendering
		self.format();
	},
	format: function() {
		var self = this;

		// hide the mutation diagram filter info text by default
		self.$el.find(".mutation-details-filter-info").hide();
		self.$el.find(".mutation-details-no-data-info").hide();
	},
	/**
	 * Initializes the main components (such as the mutation diagram
	 * and the table) of the view.
	 *
	 * @param mut3dVisView 3D visualizer view
	 * @return {Object} all components as a single object
	 */
	initComponents: function(mut3dVisView)
	{
		var self = this;
		var gene = self.model.geneSymbol;
		var mutationData = self.model.mutationData;
		var dataProxies = self.model.dataProxies;
		var sequence = self.model.sequence;
		var diagramOpts = self.model.diagramOpts;
		var tableOpts = self.model.tableOpts;

		// draw mutation diagram
		var diagramView = self._initMutationDiagramView(
				gene, mutationData, sequence, dataProxies, diagramOpts);

		var diagram = diagramView.mutationDiagram;

		var view3d = null;

		// init 3D view if the diagram is initialized successfully
		if (diagram)
		{
			if (mut3dVisView)
			{
				// init the 3d view
				view3d = self._init3dView(gene,
					sequence,
					self.model.dataProxies.pdbProxy,
					mut3dVisView);
			}
		}
		else
		{
			console.log("Error initializing mutation diagram: %s", gene);
		}

		// init mutation table view
		var tableView = self._initMutationTableView(gene, mutationData, dataProxies, tableOpts);

		// update component references
		self._mutationDiagram = diagram;
		self._tableView = tableView;
		self._mut3dView = view3d;

		return {
			diagram: diagram,
			tableView: tableView,
			view3d: view3d
		};
	},
	initPdbPanelView: function(pdbColl)
	{
		var self = this;

		var panelOpts = {
			//el: "#mutation_pdb_panel_view_" + gene.toUpperCase(),
			el: self.$el.find(".mutation-pdb-panel-view"),
			model: {geneSymbol: self.model.geneSymbol,
				pdbColl: pdbColl,
				pdbProxy: self.model.dataProxies.pdbProxy},
			diagram: self._mutationDiagram
		};

		var pdbPanelView = new PdbPanelView(panelOpts);
		pdbPanelView.render();

		self._pdbPanelView = pdbPanelView;

		return pdbPanelView;
	},
	/**
	 * Generates a one-line summary of the mutation data.
	 *
	 * @return {string} summary string
	 */
	_mutationSummary: function()
	{
		var self = this;
		var mutationUtil = self.model.dataProxies.mutationProxy.getMutationUtil();
		var gene = self.model.geneSymbol;
		var cases = self.model.sampleArray;

		var summary = "";

		if (cases.length > 0)
		{
			// calculate somatic & germline mutation rates
			var mutationCount = mutationUtil.countMutations(gene, cases);
			// generate summary string for the calculated mutation count values
			summary = mutationUtil.generateSummary(mutationCount);
		}

		return summary;
	},
	/**
	 * Initializes the 3D view initializer.
	 *
	 * @param gene
	 * @param sequence
	 * @param pdbProxy
	 * @param mut3dVisView
	 * @return {Object}     a Mutation3dView instance
	 */
	_init3dView: function(gene, sequence, pdbProxy, mut3dVisView)
	{
		var self = this;
		var view3d = null;

		// init the 3d view
		if (mut3dVisView)
		{
			view3d = new Mutation3dView({
				el: self.$el.find(".mutation-3d-initializer"),
				model: {uniprotId: sequence.metadata.identifier,
					geneSymbol: gene,
					pdbProxy: pdbProxy}
			});

			view3d.render();

			// also reset (init) the 3D view if the 3D panel is already active
			if (mut3dVisView.isVisible())
			{
				view3d.resetView();
			}
		}

		return view3d;
	},
	/**
	 * Initializes the mutation diagram view.
	 *
	 * @param gene          hugo gene symbol
	 * @param mutationData  mutation data (array of JSON objects)
	 * @param sequenceData  sequence data (as a JSON object)
	 * @param dataProxies   all available data proxies
	 * @param options       [optional] diagram options
	 * @return {Object}     initialized mutation diagram view
	 */
	_initMutationDiagramView: function (gene, mutationData, sequenceData, dataProxies, options)
	{
		var self = this;

		var model = {mutations: mutationData,
			sequence: sequenceData,
			geneSymbol: gene,
			dataProxies: dataProxies,
			diagramOpts: options};

		var diagramView = new MutationDiagramView({
			el: self.$el.find(".mutation-diagram-view"),
			model: model});

		diagramView.render();

		return diagramView;
	},
	/**
	 * Initializes the mutation table view.
	 *
	 * @param gene          hugo gene symbol
	 * @param mutationData  mutation data (array of JSON objects)
	 * @param dataProxies   all available data proxies
	 * @param options       [optional] table options
	 * @return {Object}     initialized mutation table view
	 */
	_initMutationTableView: function(gene, mutationData, dataProxies, options)
	{
		var self = this;

		var mutationTableView = new MutationDetailsTableView({
			el: self.$el.find(".mutation-table-container"),
			model: {geneSymbol: gene,
				mutations: mutationData,
				dataProxies: dataProxies,
				tableOpts: options}
		});

		mutationTableView.render();

		return mutationTableView;
	},
	/**
	 * Initializes the filter reset link, which is a part of filter info
	 * text on top of the diagram, with the given callback function.
	 *
	 * @param callback      function to be invoked on click
	 */
	addResetCallback: function(callback) {
		var self = this;
		var resetLink = self.$el.find(".mutation-details-filter-reset");

		// add listener to diagram reset link
		resetLink.click(callback);
	},
	showFilterInfo: function() {
		this.$el.find(".mutation-details-filter-info").slideDown();
	},
	hideFilterInfo: function() {
		this.$el.find(".mutation-details-filter-info").slideUp();
	},
	showNoDataInfo: function() {
		this.$el.find(".mutation-details-no-data-info").slideDown();
	},
	hideNoDataInfo: function() {
		this.$el.find(".mutation-details-no-data-info").slideUp();
	}
});
